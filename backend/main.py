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

# Import core modules - Phase 2
from core.hashing import calculate_sha256, calculate_phash_sequence, calculate_sequence_similarity
from core.signing import (
    generate_key_pair, 
    generate_manifest, 
    canonical_json_encode,
    compute_manifest_hash,
    verify_manifest_signature,
    verify_stored_signature,
    verify_signature_detached
)
from core.database import (
    init_db, 
    create_creator,
    save_video_record, 
    find_video_by_hash, 
    find_video_by_phash,
    find_video_by_sha256,
    get_video_by_credential_id,
    create_processing_job,
    update_processing_job,
    get_processing_status,
    generate_credential_id,
    create_unsigned_video_record,
    finalize_video_signature,
    link_job_to_video,
    compute_key_fingerprint
)

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="VCA Backend", description="Video Content Authentication API - Phase 2 Implementation (Client-Side Signing)")

# Initialize DB
init_db()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Phase 2: In-memory task tracking replaced with database (minimal cache for active processing)
TASKS: Dict[str, dict] = {}

# Ensure uploads directory makes sense relative to this file
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Pydantic Models - Phase 2
class UploadResponse(BaseModel):
    task_id: str
    message: str

class StatusResponse(BaseModel):
    task_id: str
    status: str
    progress: int
    step: str
    phase: Optional[str] = None
    result: Optional[Dict] = None
    error: Optional[str] = None

class FinalizeSignatureRequest(BaseModel):
    task_id: str
    signature: str
    public_key: str
    creator_name: Optional[str] = None

class FinalizeSignatureResponse(BaseModel):
    credential_id: str
    manifest: Dict
    manifest_hash: str
    signature_valid: bool
    status: str

class VerifyResponse(BaseModel):
    status: str
    match_type: str
    credential_id: Optional[str] = None
    creator_info: Optional[Dict] = None
    signature_valid: Optional[bool] = None
    manifest_hash: Optional[str] = None
    key_fingerprint: Optional[str] = None
    matches: Optional[List[Dict]] = None
    message: Optional[str] = None

class IdentityResponse(BaseModel):
    public_key: str
    creator_id: str
    key_fingerprint: str

class ProcessingResult(BaseModel):
    task_id: str
    credential_id: str
    canonical_manifest: str
    manifest_hash: str
    hash_algorithm: str
    phash_algorithm: str
    manifest_version: str

@app.get("/")
def read_root():
    return {
        "status": "VCA System Operational", 
        "version": "Backend v2.0 - Phase 2", 
        "storage": str(UPLOAD_DIR),
        "phase": "Client-Side Signing Architecture",
        "features": ["Canonical JSON", "Client-Side Ed25519", "Full pHash Sequence", "Time-Based Sampling"]
    }

def process_video_task(task_id: str, file_path: str, filename: str, file_size: int, mime_type: str):
    """
    Phase 2 - Background task to process video with client-side signing preparation
    
    Implements:
    1. SHA-256 hash calculation (Hard Binding)
    2. Time-based sparse frame sampling with dHash (Soft Binding)
    3. Canonical manifest generation
    4. Manifest hash computation
    5. Unsigned video record creation
    """
    try:
        logger.info(f"Starting Phase 2 processing task {task_id} for {filename}")
        
        # Update task status in both memory and DB
        TASKS[task_id]["status"] = "processing"
        TASKS[task_id]["phase"] = "hashing"
        update_processing_job(task_id, "processing", 10, "hashing")
        
        # 1. SHA-256 Hash Calculation (Hard Binding)
        TASKS[task_id]["step"] = "SHA-256 Calculation"
        sha256 = calculate_sha256(str(file_path))
        TASKS[task_id]["progress"] = 30
        logger.info(f"SHA-256 calculated: {sha256[:16]}...")
        
        # Check for duplicate SHA
        existing = find_video_by_sha256(sha256)
        if existing:
            logger.info(f"Duplicate SHA detected: {existing['credential_id']}")
            TASKS[task_id]["status"] = "complete"
            TASKS[task_id]["progress"] = 100
            TASKS[task_id]["result"] = {
                "duplicate": True,
                "credential_id": existing["credential_id"],
                "message": "Video already exists in system"
            }
            update_processing_job(task_id, "complete", 100, "complete", TASKS[task_id]["result"])
            return
        
        # 2. Sparse Frame Sampling with dHash (Soft Binding) - Phase 2: Time-based
        TASKS[task_id]["step"] = "Perceptual Hashing"
        TASKS[task_id]["phase"] = "frame_extraction"
        update_processing_job(task_id, "processing", 40, "frame_extraction")
        
        phash_sequence = calculate_phash_sequence(str(file_path))
        TASKS[task_id]["progress"] = 70
        logger.info(f"Generated {len(phash_sequence)} frame hashes for soft binding")
        
        # 3. Create unsigned video record
        TASKS[task_id]["phase"] = "phash"
        update_processing_job(task_id, "processing", 80, "phash")
        
        video_id, credential_id = create_unsigned_video_record(
            filename=filename,
            file_size=file_size,
            mime_type=mime_type,
            sha256=sha256,
            phash=phash_sequence[0] if phash_sequence else "0000000000000000",
            phash_sequence=phash_sequence
        )
        
        # Link job to video
        link_job_to_video(task_id, video_id)
        
        # 4. Generate canonical manifest (without signature)
        asset_info = {
            "name": filename,
            "hash": sha256,
            "size": file_size,
            "mimetype": mime_type
        }
        
        # Placeholder for public key - will be filled during finalization
        placeholder_public_key = "PENDING_CLIENT_SIGNATURE"
        manifest = generate_manifest(
            creator_public_key=placeholder_public_key,
            asset_info=asset_info,
            phash_sequence=phash_sequence,
            manifest_hash="PENDING"  # Will be computed below
        )
        
        # 5. Compute manifest hash
        manifest_hash = compute_manifest_hash(manifest)
        manifest["manifest_hash"] = manifest_hash
        
        # Update manifest_hash in assertions
        for assertion in manifest.get("assertions", []):
            if assertion.get("label") == "vca.integrity":
                assertion["data"]["manifest_hash"] = manifest_hash
        
        # Generate canonical JSON for client signing
        canonical_manifest = canonical_json_encode(manifest)
        
        # 6. Complete Processing
        TASKS[task_id]["step"] = "Finalizing"
        TASKS[task_id]["phase"] = "complete"
        TASKS[task_id]["progress"] = 100
        TASKS[task_id]["status"] = "complete"
        TASKS[task_id]["result"] = {
            "filename": filename,
            "sha256": sha256,
            "phash_sequence": phash_sequence,
            "size": file_size,
            "mimetype": mime_type,
            "frame_count": len(phash_sequence),
            "credential_id": credential_id,
            "canonical_manifest": canonical_manifest,
            "manifest_hash": manifest_hash
        }
        
        # Update DB with result
        update_processing_job(task_id, "complete", 100, "complete", TASKS[task_id]["result"])
        
        logger.info(f"Phase 2 processing completed for task {task_id}, credential: {credential_id}")
        
    except Exception as e:
        import traceback
        error_msg = f"{type(e).__name__}: {str(e)}"
        logger.error(f"Task {task_id} failed: {error_msg}")
        logger.error(traceback.format_exc())
        TASKS[task_id]["status"] = "error"
        TASKS[task_id]["error"] = error_msg
        TASKS[task_id]["progress"] = 0
        update_processing_job(task_id, "error", 0, error_message=error_msg)

@app.post("/api/intake/upload", response_model=UploadResponse)
async def upload_video(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Phase 2 - Video Upload Pipeline with Client-Side Signing Preparation
    
    Implements:
    - Secure file upload with validation
    - SHA-256 hash calculation for exact integrity verification
    - Time-based sparse frame sampling for robustness
    - Canonical manifest generation
    - Returns manifest for client-side signing
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
        
    # Initialize task tracking (in-memory and DB)
    TASKS[task_id] = {
        "status": "pending", 
        "step": "Queued", 
        "phase": "pending",
        "progress": 0,
        "filename": file.filename,
        "size": file_size,
        "mimetype": mime_type
    }
    
    # Create processing job in DB
    create_processing_job(task_id, "video_upload")
    
    # Start processing in background
    background_tasks.add_task(process_video_task, task_id, str(file_path), file.filename, file_size, mime_type)
    
    logger.info(f"Phase 2 upload completed: {file.filename} ({file_size} bytes) - Task ID: {task_id}")
    
    return UploadResponse(
        task_id=task_id,
        message="Video received. Phase 2 processing started. Await canonical manifest for client signing."
    )

@app.get("/api/intake/status/{task_id}", response_model=StatusResponse)
def get_status(task_id: str):
    """Get processing status for a video task (Phase 2)"""
    # First check in-memory cache
    if task_id in TASKS:
        task = TASKS[task_id]
        return StatusResponse(
            task_id=task_id,
            status=task["status"],
            progress=task.get("progress", 0),
            step=task.get("step", "Unknown"),
            phase=task.get("phase"),
            result=task.get("result"),
            error=task.get("error")
        )
    
    # Fallback to DB query
    db_status = get_processing_status(task_id)
    if db_status:
        return StatusResponse(
            task_id=task_id,
            status=db_status["status"],
            progress=db_status.get("progress", 0),
            step=db_status.get("phase", "Unknown"),
            phase=db_status.get("phase"),
            result=db_status.get("result"),
            error=db_status.get("error_message")
        )
    
    raise HTTPException(status_code=404, detail="Task not found")

@app.post("/api/intake/finalize-signature", response_model=FinalizeSignatureResponse)
def finalize_signature(req: FinalizeSignatureRequest):
    """
    Phase 2 - Finalize Video Signature (Client-Side Signing)
    
    This endpoint receives the client-generated signature and verifies it:
    - Receives signature from browser (tweetnacl)
    - Verifies signature against stored canonical manifest
    - Creates/updates creator identity
    - Stores signature, public_key, key_fingerprint, sealed_at
    """
    task_id = req.task_id
    
    # Get task result
    if task_id not in TASKS or TASKS[task_id].get("status") != "complete":
        raise HTTPException(status_code=400, detail="Processing not complete or task not found")
    
    result = TASKS[task_id]["result"]
    
    # Check for duplicate
    if result.get("duplicate"):
        raise HTTPException(status_code=409, detail=f"Video already exists: {result.get('credential_id')}")
    
    credential_id = result.get("credential_id")
    if not credential_id:
        raise HTTPException(status_code=500, detail="Credential ID not found in task result")
    
    # Get canonical manifest and re-generate for verification
    canonical_manifest = result.get("canonical_manifest")
    manifest_hash = result.get("manifest_hash")
    
    if not canonical_manifest:
        raise HTTPException(status_code=500, detail="Canonical manifest not found")
    
    # Verify the signature against the exact canonical manifest string
    # The frontend signed the canonical JSON string, so we verify against that directly
    message_bytes = canonical_manifest.encode('utf-8')
    is_valid = verify_signature_detached(message_bytes, req.signature, req.public_key)
    
    if not is_valid:
        logger.error(f"Signature verification failed for task {task_id}")
        raise HTTPException(status_code=400, detail="Signature verification failed")
    
    # Create or get creator identity
    creator_id = create_creator(req.public_key, req.creator_name)
    
    # Regenerate manifest with actual public key
    asset_info = {
        "name": result["filename"],
        "hash": result["sha256"],
        "size": result["size"],
        "mimetype": result["mimetype"]
    }
    
    manifest = generate_manifest(
        creator_public_key=req.public_key,
        asset_info=asset_info,
        phash_sequence=result["phash_sequence"],
        manifest_hash=manifest_hash
    )
    manifest["signature"] = req.signature
    
    # Finalize the video record
    success = finalize_video_signature(
        credential_id=credential_id,
        creator_id=creator_id,
        manifest=manifest,
        manifest_hash=manifest_hash,
        signature=req.signature,
        public_key=req.public_key
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to finalize video signature")
    
    # Cleanup temporary files
    file_path = UPLOAD_DIR / f"{task_id}_{result['filename']}"
    if file_path.exists():
        os.remove(file_path)
    
    logger.info(f"Phase 2 signature finalized: {credential_id} for {result['filename']}")
    
    return FinalizeSignatureResponse(
        credential_id=credential_id,
        manifest=manifest,
        manifest_hash=manifest_hash,
        signature_valid=True,
        status="sealed"
    )

@app.post("/api/verify", response_model=VerifyResponse)
async def verify_video(file: UploadFile = File(...)):
    """
    Phase 2 - Dual Verification Engine (Hard + Soft Binding + Signature Verification)
    
    Implements the verification logic:
    1. Exact Match: SHA-256 hash comparison (Hard Binding)
    2. Soft Match: pHash sequence comparison with weighted Hamming distance
    3. Signature Verification: Re-verify stored signature
    4. No Match: Unverified content
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
            
            # Phase 2: Verify stored signature
            signature_valid = verify_stored_signature(exact_match)
            
            return VerifyResponse(
                status="verified",
                match_type="exact",
                credential_id=exact_match["credential_id"],
                creator_info={
                    "public_key": exact_match.get("public_key"),
                    "name": exact_match.get("creator_name")
                },
                signature_valid=signature_valid,
                manifest_hash=exact_match.get("manifest_hash"),
                key_fingerprint=exact_match.get("key_fingerprint"),
                message="Authentic Original - Exact SHA-256 match" + (" | Signature Valid" if signature_valid else " | Signature Invalid")
            )
        
        # 2. Soft Binding - pHash Similarity Check (Phase 2: Multi-frame)
        phash_sequence = calculate_phash_sequence(str(temp_path))
        if phash_sequence:
            similar_matches = find_video_by_phash(phash_sequence[0], phash_sequence)
            
            if similar_matches:
                best_match = similar_matches[0]
                match_percentage = calculate_sequence_similarity(phash_sequence, best_match.get("phash_sequence", []))
                
                logger.info(f"Soft match found: {best_match['credential_id']} (similarity: {match_percentage:.1f}%)")
                
                # Phase 2: Verify signature of matched record
                signature_valid = verify_stored_signature(best_match)
                
                return VerifyResponse(
                    status="verified" if match_percentage > 85 else "warning",
                    match_type="similar",
                    credential_id=best_match["credential_id"],
                    creator_info={
                        "public_key": best_match.get("public_key"),
                        "name": best_match.get("creator_name")
                    },
                    signature_valid=signature_valid,
                    manifest_hash=best_match.get("manifest_hash"),
                    key_fingerprint=best_match.get("key_fingerprint"),
                    matches=similar_matches[:5],
                    message=f"Verified but re-encoded (Similarity: {match_percentage:.1f}%)" + (" | Signature Valid" if signature_valid else " | Signature Invalid")
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
    """
    Phase 2 - Identity Layer: Generate Ed25519 key pair for creator
    
    Creates a new cryptographic identity for content creators.
    NOTE: In Phase 2, private keys are generated CLIENT-SIDE using tweetnacl.
    This endpoint only returns the public components after client registration.
    
    For server-side key generation (deprecated in Phase 2):
    - Use only for testing/development
    - Private key should be transferred securely to client
    """
    private_key, public_key = generate_key_pair()
    key_fingerprint = compute_key_fingerprint(public_key)
    
    # Create creator record in database
    creator_id = create_creator(public_key)
    
    logger.info(f"Generated new creator identity: {creator_id[:8]}... fingerprint: {key_fingerprint[:16]}...")
    
    # Phase 2: Return public components only
    # Client should use tweetnacl for key generation in production
    return IdentityResponse(
        public_key=public_key,
        creator_id=creator_id,
        key_fingerprint=key_fingerprint
    )

class RegisterIdentityRequest(BaseModel):
    public_key: str
    display_name: Optional[str] = None

@app.post("/api/identity/register")
def register_identity(req: RegisterIdentityRequest):
    """
    Phase 2 - Register a client-generated public key
    
    Client generates keypair using tweetnacl:
    - const keypair = nacl.sign.keyPair()
    - Send publicKey (base64) to this endpoint
    """
    if not req.public_key or len(req.public_key) < 32:
        raise HTTPException(status_code=400, detail="Invalid public key")
    
    key_fingerprint = compute_key_fingerprint(req.public_key)
    creator_id = create_creator(req.public_key, req.display_name)
    
    logger.info(f"Registered client identity: {creator_id[:8]}... fingerprint: {key_fingerprint[:16]}...")
    
    return {
        "creator_id": creator_id,
        "key_fingerprint": key_fingerprint,
        "status": "registered"
    }

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
        "phase": "Phase 2 - Client-Side Signing Architecture",
        "features": [
            "Canonical JSON Serialization",
            "Client-Side Ed25519 Signing",
            "Full pHash Sequence Storage",
            "Time-Based Frame Sampling",
            "Signature Verification on Retrieval",
            "Multi-Frame Similarity Scoring"
        ],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
