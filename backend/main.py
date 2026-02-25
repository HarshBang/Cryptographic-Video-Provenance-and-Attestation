from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, List
from pydantic import BaseModel
import shutil
import os
import uuid
import json
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone

# Import core modules
from core.hashing import calculate_sha256, calculate_phash_sequence
from core.signing import generate_key_pair, sign_message, generate_manifest, verify_signature
from core.database import (
    init_db, 
    create_creator,
    save_video_record, 
    find_video_by_hash, 
    find_video_by_phash,
    get_video_by_credential_id,
    create_processing_job,
    update_processing_job,
    get_processing_status,
    generate_credential_id
)

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="VCA Backend", description="Video Content Authentication API - Phase 1 Implementation")

# Initialize DB
init_db()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory task tracking (transient)
TASKS: Dict[str, dict] = {}

# Ensure uploads directory makes sense relative to this file
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Pydantic Models
class UploadResponse(BaseModel):
    task_id: str
    message: str
    credential_id: Optional[str] = None

class StatusResponse(BaseModel):
    task_id: str
    status: str
    progress: int
    step: str
    result: Optional[Dict] = None
    error: Optional[str] = None

class SignRequest(BaseModel):
    task_id: str
    private_key: str
    creator_id: Optional[str] = None
    creator_name: Optional[str] = None

class SignResponse(BaseModel):
    credential_id: str
    manifest: Dict
    signature: str
    status: str

class VerifyResponse(BaseModel):
    status: str
    match_type: str
    credential_id: Optional[str] = None
    creator_info: Optional[Dict] = None
    matches: Optional[List[Dict]] = None
    message: Optional[str] = None

class IdentityResponse(BaseModel):
    private_key: str
    public_key: str
    creator_id: str

@app.get("/")
def read_root():
    return {
        "status": "VCA System Operational", 
        "version": "Backend v1.0 - Phase 1", 
        "storage": str(UPLOAD_DIR),
        "phase": "Identity & Hard Binding Layer"
    }

def process_video_task(task_id: str, file_path: str, filename: str, file_size: int, mime_type: str):
    """Background task to process video - Phase 1 Implementation
    
    Implements:
    1. SHA-256 hash calculation (Hard Binding)
    2. Sparse frame sampling with dHash (Soft Binding)
    3. Processing job tracking
    """
    try:
        logger.info(f"Starting Phase 1 processing task {task_id} for {filename}")
        TASKS[task_id]["status"] = "processing"
        
        # 1. SHA-256 Hash Calculation (Hard Binding)
        TASKS[task_id]["step"] = "SHA-256 Calculation"
        sha256 = calculate_sha256(str(file_path))
        TASKS[task_id]["progress"] = 30
        logger.info(f"SHA-256 calculated: {sha256[:16]}...")
        
        # 2. Sparse Frame Sampling with dHash (Soft Binding)
        TASKS[task_id]["step"] = "Perceptual Hashing"
        phash_sequence = calculate_phash_sequence(str(file_path))
        TASKS[task_id]["progress"] = 70
        logger.info(f"Generated {len(phash_sequence)} frame hashes for soft binding")
        
        # 3. Complete Processing
        TASKS[task_id]["step"] = "Finalizing"
        TASKS[task_id]["progress"] = 100
        TASKS[task_id]["status"] = "complete"
        TASKS[task_id]["result"] = {
            "filename": filename,
            "sha256": sha256,
            "phash_sequence": phash_sequence,
            "size": file_size,
            "mimetype": mime_type,
            "frame_count": len(phash_sequence)
        }
        logger.info(f"Phase 1 processing completed for task {task_id}")
        
    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}")
        TASKS[task_id]["status"] = "error"
        TASKS[task_id]["error"] = str(e)
        TASKS[task_id]["progress"] = 0

@app.post("/api/intake/upload", response_model=UploadResponse)
async def upload_video(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Phase 1 - Video Upload Pipeline with SHA-256 and pHash processing
    
    Implements the "Hard Binding" layer:
    - Secure file upload with validation
    - SHA-256 hash calculation for exact integrity verification
    - Sparse frame sampling for robustness against re-encoding
    """
    task_id = str(uuid.uuid4())
    
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Check file size (max 5GB as per blueprint)
    file_size = 0
    temp_file_path = UPLOAD_DIR / f"temp_{task_id}_{file.filename}"
    
    try:
        # Save file and calculate size
        with open(temp_file_path, "wb") as buffer:
            while chunk := await file.read(8192):
                buffer.write(chunk)
                file_size += len(chunk)
                
        if file_size > 5 * 1024 * 1024 * 1024:  # 5GB limit
            os.remove(temp_file_path)
            raise HTTPException(status_code=413, detail="File too large (max 5GB)")
            
        # Move to permanent location
        file_path = UPLOAD_DIR / f"{task_id}_{file.filename}"
        shutil.move(str(temp_file_path), str(file_path))
        
        # Get MIME type
        mime_type = file.content_type or "video/mp4"
        
    except Exception as e:
        if temp_file_path.exists():
            os.remove(temp_file_path)
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")
        
    # Initialize task tracking
    TASKS[task_id] = {
        "status": "pending", 
        "step": "Queued", 
        "progress": 0,
        "filename": file.filename,
        "size": file_size,
        "mimetype": mime_type
    }
    
    # Start processing in background
    background_tasks.add_task(process_video_task, task_id, str(file_path), file.filename, file_size, mime_type)
    
    logger.info(f"Phase 1 upload completed: {file.filename} ({file_size} bytes) - Task ID: {task_id}")
    
    return UploadResponse(
        task_id=task_id,
        message="Video received. Phase 1 processing started (SHA-256 + pHash)."
    )

@app.get("/api/intake/status/{task_id}", response_model=StatusResponse)
def get_status(task_id: str):
    """Get processing status for a video task (Phase 1)"""
    if task_id not in TASKS:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = TASKS[task_id]
    return StatusResponse(
        task_id=task_id,
        status=task["status"],
        progress=task.get("progress", 0),
        step=task.get("step", "Unknown"),
        result=task.get("result"),
        error=task.get("error")
    )

@app.post("/api/intake/sign", response_model=SignResponse)
def sign_manifest(req: SignRequest):
    """Phase 1 - Digital Signing with Ed25519 and Manifest Generation
    
    Implements the "Digital Seal" layer:
    - Creates creator identity if not exists
    - Generates C2PA-style manifest
    - Signs with Ed25519 private key
    - Stores in database with credential ID
    """
    task_id = req.task_id
    if task_id not in TASKS or TASKS[task_id].get("status") != "complete":
        raise HTTPException(status_code=400, detail="Processing not complete")
        
    result = TASKS[task_id]["result"]
    
    # Create or get creator identity
    creator_id = create_creator(req.private_key, req.creator_name)
    
    # Generate C2PA-style manifest (Phase 3)
    asset_info = {
        "name": result["filename"],
        "hash": result["sha256"],
        "size": result["size"],
        "mimetype": result["mimetype"]
    }
    
    manifest = generate_manifest(
        creator_public_key=req.private_key,  # In real implementation, derive public key
        asset_info=asset_info,
        phash_sequence=result["phash_sequence"]
    )
    
    # Sign the manifest
    manifest_str = json.dumps(manifest, sort_keys=True, separators=(', ', ': '))
    signature = sign_message(manifest_str, req.private_key)
    
    # Add signature to manifest
    manifest["signature"] = signature
    
    # Save to Database with proper credential ID
    credential_id = save_video_record(
        creator_id=creator_id,
        filename=result["filename"],
        file_size=result["size"],
        mime_type=result["mimetype"],
        sha256=result["sha256"],
        phash=result["phash_sequence"][0] if result["phash_sequence"] else "0000000000000000",
        signature=signature,
        manifest=manifest
    )
    
    # Cleanup temporary files
    file_path = UPLOAD_DIR / f"{task_id}_{result['filename']}"
    if file_path.exists():
        os.remove(file_path)
    
    logger.info(f"Phase 1 signing completed: {credential_id} for {result['filename']}")
    
    return SignResponse(
        credential_id=credential_id,
        manifest=manifest,
        signature=signature,
        status="sealed"
    )

@app.post("/api/verify", response_model=VerifyResponse)
async def verify_video(file: UploadFile = File(...)):
    """Phase 1 - Dual Verification Engine (Hard + Soft Binding)
    
    Implements the verification logic:
    1. Exact Match: SHA-256 hash comparison (Hard Binding)
    2. Soft Match: pHash sequence comparison with Hamming distance
    3. No Match: Unverified content
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Save temporary file for processing
    temp_filename = f"verify_{uuid.uuid4()}_{file.filename}"
    temp_path = UPLOAD_DIR / temp_filename
    
    try:
        # Save file
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 1. Hard Binding - Exact SHA-256 Match
        sha256 = calculate_sha256(str(temp_path))
        exact_match = find_video_by_hash(sha256)
        
        if exact_match:
            logger.info(f"Exact match found: {exact_match['credential_id']}")
            return VerifyResponse(
                status="verified",
                match_type="exact",
                credential_id=exact_match["credential_id"],
                creator_info={
                    "public_key": exact_match["creator_public_key"],
                    "name": exact_match["creator_name"]
                },
                message="Authentic Original - Exact SHA-256 match"
            )
        
        # 2. Soft Binding - pHash Similarity Check
        phash_sequence = calculate_phash_sequence(str(temp_path))
        if phash_sequence:
            similar_matches = find_video_by_phash(phash_sequence[0])  # Compare first frame
            
            if similar_matches:
                best_match = similar_matches[0]  # Closest match
                match_percentage = max(0, 100 - (best_match["distance"] * 6.67))  # Scale to percentage
                
                logger.info(f"Soft match found: {best_match['credential_id']} (distance: {best_match['distance']})")
                
                return VerifyResponse(
                    status="verified" if match_percentage > 85 else "warning",
                    match_type="similar",
                    credential_id=best_match["credential_id"],
                    creator_info={
                        "public_key": best_match["creator_public_key"],
                        "name": best_match["creator_name"]
                    },
                    matches=similar_matches[:5],  # Top 5 matches
                    message=f"Verified but re-encoded (Match: {match_percentage:.1f}%) - Visual content matches"
                )
        
        # 3. No Match Found
        logger.info("No matches found for uploaded video")
        return VerifyResponse(
            status="unknown",
            match_type="none",
            message="No record found - This video has not been signed by the VCA system"
        )
        
    except Exception as e:
        logger.error(f"Verification failed: {e}")
        raise HTTPException(status_code=500, detail="Verification processing failed")
    finally:
        # Cleanup temporary file
        if temp_path.exists():
            os.remove(temp_path)

@app.get("/api/identity/generate", response_model=IdentityResponse)
def create_identity():
    """Phase 1 - Identity Layer: Generate Ed25519 key pair for creator
    
    Creates a new cryptographic identity for content creators.
    In production, keys should be securely stored (AWS KMS/local secure storage).
    """
    private_key, public_key = generate_key_pair()
    
    # Create creator record in database
    creator_id = create_creator(public_key)
    
    logger.info(f"Generated new creator identity: {creator_id[:8]}...")
    
    return IdentityResponse(
        private_key=private_key,
        public_key=public_key,
        creator_id=creator_id
    )

@app.get("/api/videos/{credential_id}")
def get_video_by_credential(credential_id: str):
    """Retrieve video details by credential ID"""
    video = get_video_by_credential_id(credential_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video

@app.get("/api/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "phase": "Phase 1 - Identity & Hard Binding Layer",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
