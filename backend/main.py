from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
    sign_message,
    verify_manifest_signature,
    verify_stored_signature,
    verify_signature_detached
)
from core.auth import get_current_user
from core.email_utils import send_seal_confirmation
from core.database import (
    init_db, 
    create_creator,
    get_creator,
    save_video_record, 
    find_video_by_hash, 
    find_video_by_phash,
    find_video_by_sha256,
    get_video_by_credential_id,
    list_videos,
    create_processing_job,
    update_processing_job,
    get_processing_status,
    generate_credential_id,
    create_unsigned_video_record,
    finalize_video_signature,
    link_job_to_video,
    compute_key_fingerprint,
    delete_unsealed_video
)

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="VCA Backend", description="Video Content Authentication API - Phase 2 Implementation (Client-Side Signing)")

# Initialize DB
init_db()

# Enable CORS for frontend
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"
)
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
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

# Mount uploads directory so frontend can use native <video> thumbnail extraction
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

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

class FinalizeSignatureResponse(BaseModel):
    credential_id: str
    manifest: Dict
    manifest_hash: str
    signature_valid: bool
    status: str

class VerifyUrlRequest(BaseModel):
    url: str

class VerifyResponse(BaseModel):
    status: str
    match_type: str
    credential_id: Optional[str] = None
    creator_info: Optional[Dict] = None
    creator_email: Optional[str] = None
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
            if existing.get("status") == "sealed":
                logger.info(f"Duplicate SEALD SHA detected: {existing['credential_id']}")
                TASKS[task_id]["status"] = "complete"
                TASKS[task_id]["progress"] = 100
                TASKS[task_id]["result"] = {
                    "duplicate": True,
                    "credential_id": existing["credential_id"],
                    "message": "Video already exists in system"
                }
                update_processing_job(task_id, "complete", 100, "complete", TASKS[task_id]["result"])
                return
            else:
                # The video was uploaded before but the signing process was abandoned/failed.
                # Delete the ghost record so we don't hit a UNIQUE constraint error on the SHA-256 column.
                logger.info(f"Found abandoned unsealed video {existing['id']} with same SHA. Cleaning up to allow re-upload.")
                delete_unsealed_video(existing["id"])
        
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
        file_path = UPLOAD_DIR / file.filename
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
def finalize_signature(req: FinalizeSignatureRequest, current_user: dict = Depends(get_current_user)):
    """
    Phase 2 - Finalize Video Signature (Backend Custodial Signing)
    
    This endpoint retrieves the user's stored private key and signs the manifest:
    - Verifies task completion
    - Fetches the creator profile (private key)
    - Generates the signature locally on the backend
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
    
    manifest_hash = result.get("manifest_hash")
    
    # Fetch creator identity
    creator = get_creator(current_user["id"])
    if not creator or not creator.get("private_key"):
        raise HTTPException(status_code=400, detail="Creator identity not found or private key missing. Call /api/identity/me first.")
        
    public_key = creator["public_key"]
    private_key = creator["private_key"]
    
    # Regenerate manifest with actual public key
    asset_info = {
        "name": result["filename"],
        "hash": result["sha256"],
        "size": result["size"],
        "mimetype": result["mimetype"]
    }
    
    manifest = generate_manifest(
        creator_public_key=public_key,
        asset_info=asset_info,
        phash_sequence=result["phash_sequence"],
        manifest_hash=manifest_hash
    )
    
    # Sign the canonical manifest
    message = canonical_json_encode(manifest)
    message_bytes = message.encode('utf-8')
    signature = sign_message(message_bytes, private_key)
    
    manifest["signature"] = signature
    
    # Finalize the video record
    success = finalize_video_signature(
        credential_id=credential_id,
        creator_id=creator["id"],
        manifest=manifest,
        manifest_hash=manifest_hash,
        signature=signature,
        public_key=public_key
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to finalize video signature")
    
    # (Removed temporary file cleanup - file is intentionally kept for Dashboard thumbnails)
    
    logger.info(f"Phase 2 signature finalized: {credential_id} for {result['filename']}")

    # Send seal confirmation email to creator
    creator_email = current_user.get("email")
    if creator_email:
        from datetime import datetime, timezone
        sealed_at_str = datetime.now(timezone.utc).isoformat()
        try:
            send_seal_confirmation(
                to_email=creator_email,
                creator_name=creator.get("display_name") or current_user.get("name") or "Creator",
                filename=result["filename"],
                credential_id=credential_id,
                sealed_at=sealed_at_str,
                manifest_hash=manifest_hash or "",
            )
        except Exception as e:
            logger.warning(f"Email send failed (non-fatal): {e}")
    
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
                creator_email=exact_match.get("creator_email"),
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
                    creator_email=best_match.get("creator_email"),
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

@app.post("/api/verify/url", response_model=VerifyResponse)
async def verify_video_url(req: VerifyUrlRequest):
    """
    Phase 2 - Social Media Authenticator (URL Verification)
    Downloads streaming video from URL using yt-dlp, runs verification, and cleans up.
    """
    url = req.url
    if not url:
        raise HTTPException(status_code=400, detail="No URL provided")
        
    import yt_dlp
    
    # Generate unique temp filename template for yt_dlp
    temp_filename = f"verify_url_{uuid.uuid4()}"
    temp_path_template = UPLOAD_DIR / f"{temp_filename}.%(ext)s"
    
    ydl_opts = {
        'outtmpl': str(temp_path_template),
        # Use only pre-merged formats to avoid requiring ffmpeg on the host system
        'format': 'best[ext=mp4]/best',
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
    }
    
    downloaded_file = None
    
    try:
        logger.info(f"Downloading streaming video from {url} for verification...")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            downloaded_file = Path(ydl.prepare_filename(info))
            # On some platforms the file extension changes (e.g. .webm to .mkv), so we probe what yt_dlp actually produced
            if not downloaded_file.exists():
                # Try to find the file that starts with temp_filename
                matches = list(UPLOAD_DIR.glob(f"{temp_filename}.*"))
                if matches:
                    downloaded_file = matches[0]
                else:
                    raise Exception("yt-dlp failed to produce an output file")
            
        logger.info(f"Downloaded stream to {downloaded_file}. Running dual-verification engine...")
        
        # 1. Hard Binding - Exact SHA-256 Match
        sha256 = calculate_sha256(str(downloaded_file))
        exact_match = find_video_by_hash(sha256)
        
        if exact_match:
            logger.info(f"Exact match found: {exact_match['credential_id']}")
            signature_valid = verify_stored_signature(exact_match)
            return VerifyResponse(
                status="verified",
                match_type="exact",
                credential_id=exact_match["credential_id"],
                creator_info={
                    "public_key": exact_match.get("public_key"),
                    "name": exact_match.get("creator_name")
                },
                creator_email=exact_match.get("creator_email"),
                signature_valid=signature_valid,
                manifest_hash=exact_match.get("manifest_hash"),
                key_fingerprint=exact_match.get("key_fingerprint"),
                message="Authentic Original - Exact SHA-256 match" + (" | Signature Valid" if signature_valid else " | Signature Invalid")
            )
            
        # 2. Soft Binding - pHash Similarity Check
        phash_sequence = calculate_phash_sequence(str(downloaded_file))
        if phash_sequence:
            similar_matches = find_video_by_phash(phash_sequence[0], phash_sequence)
            if similar_matches:
                best_match = similar_matches[0]
                match_percentage = calculate_sequence_similarity(phash_sequence, best_match.get("phash_sequence", []))
                
                logger.info(f"Soft match found: {best_match['credential_id']} (similarity: {match_percentage:.1f}%)")
                signature_valid = verify_stored_signature(best_match)
                
                return VerifyResponse(
                    status="verified" if match_percentage > 85 else "warning",
                    match_type="similar",
                    credential_id=best_match["credential_id"],
                    creator_info={
                        "public_key": best_match.get("public_key"),
                        "name": best_match.get("creator_name")
                    },
                    creator_email=best_match.get("creator_email"),
                    signature_valid=signature_valid,
                    manifest_hash=best_match.get("manifest_hash"),
                    key_fingerprint=best_match.get("key_fingerprint"),
                    matches=similar_matches[:5],
                    message=f"Verified Social Stream (Similarity: {match_percentage:.1f}%)" + (" | Signature Valid" if signature_valid else " | Signature Invalid")
                )
                
        # 3. No Match
        return VerifyResponse(
            status="unknown",
            match_type="none",
            message="No record found - This video stream has not been signed by the CVPA system"
        )
        
    except Exception as e:
        logger.error(f"yt-dlp verification failed for {url}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process video stream from URL.")
    finally:
        # Cleanup temp downloaded stream
        if downloaded_file and downloaded_file.exists():
            os.remove(downloaded_file)
            logger.info(f"Cleaned up social media stream temp file: {downloaded_file.name}")

@app.get("/api/identity/me")
def get_my_identity(current_user: dict = Depends(get_current_user)):
    """
    Phase 2 - Custodial Identity Initialization
    Checks if the user has a keypair. If not, generates one.
    Returns the public identity details.
    """
    creator = get_creator(current_user["id"])
    
    if not creator:
        private_key, public_key = generate_key_pair()
        create_creator(
            public_key=public_key, 
            private_key=private_key, 
            display_name=current_user["name"], 
            explicit_id=current_user["id"],
            email=current_user["email"]
        )
        creator = get_creator(current_user["id"])
        logger.info(f"Provisioned new keypair for {current_user['email']}")
        
    return {
        "creator_id": creator["id"],
        "public_key": creator["public_key"],
        "key_fingerprint": creator["key_fingerprint"],
        "display_name": creator["display_name"]
    }

@app.get("/api/videos/{credential_id}")
def get_video_by_credential(credential_id: str):
    """Retrieve video details by credential ID"""
    video = get_video_by_credential_id(credential_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video

@app.get("/api/videos")
def get_videos(limit: int = 50, offset: int = 0, current_user: dict = Depends(get_current_user)):
    """List all signed videos for dashboard - Phase 2"""
    videos = list_videos(creator_id=current_user["id"], limit=limit, offset=offset)
    return {
        "videos": videos,
        "total": len(videos),
        "limit": limit,
        "offset": offset
    }

@app.delete("/api/videos/{credential_id}")
def delete_video(credential_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a signed video completely from database and filesystem"""
    from core.database import get_db_connection
    video = get_video_by_credential_id(credential_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
        
    # Check ownership (creator_id matching was handled by join in find but we must verify here if we have it)
    # The get_video_by_credential_id returns creator_name, but not creator_id directly. Let's just run an explicit DB check.
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT id, creator_id, filename FROM videos WHERE credential_id = ?", (credential_id,))
    row = c.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Video not found")
        
    v_id, c_id, filename = row
    
    if c_id != current_user["id"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Not authorized to delete this video")
        
    try:
        # Delete from jobs first (foreign key constraint)
        c.execute("DELETE FROM processing_jobs WHERE video_id = ?", (v_id,))
        # Delete from videos
        c.execute("DELETE FROM videos WHERE id = ?", (v_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database deletion failed: {e}")
    finally:
        conn.close()
        
    # Delete from filesystem
    filepath = UPLOAD_DIR / filename
    if filepath.exists():
        try:
            os.remove(filepath)
            logger.info(f"Deleted physical file {filepath}")
        except Exception as e:
            logger.error(f"Failed to delete file {filepath}: {e}")
            
    return {"status": "success", "message": "Video unsealed and removed."}

@app.delete("/api/account")
def delete_account(current_user: dict = Depends(get_current_user)):
    """
    Delete the current user's account (creator record only).
    Videos and credentials remain in the system — only the creator login is removed.
    """
    from core.database import get_db_connection
    conn = get_db_connection()
    c = conn.cursor()
    try:
        # Nullify creator_id on videos so they remain but are unlinked
        c.execute("UPDATE videos SET creator_id = NULL WHERE creator_id = ?", (current_user["id"],))
        # Delete the creator record
        c.execute("DELETE FROM creators WHERE id = ?", (current_user["id"],))
        conn.commit()
        logger.info(f"Account deleted for user {current_user['id']}")
        return {"status": "success", "message": "Account deleted. Your signed videos remain in the system."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {e}")
    finally:
        conn.close()

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
