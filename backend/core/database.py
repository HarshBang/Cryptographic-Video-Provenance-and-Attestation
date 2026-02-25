import sqlite3
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)

# DB file stored next to this module
DB_FILE = Path(__file__).resolve().parent.parent / "vca.db"

# Credential ID format: vca_{timestamp}_{uuid_first8}
# Example: vca_20241217_1234abcd

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    # Creators Table - Identity Management
    c.execute('''CREATE TABLE IF NOT EXISTS creators (
                 id TEXT PRIMARY KEY,
                 public_key TEXT UNIQUE NOT NULL,
                 display_name TEXT,
                 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                 updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                 )''')
    
    # Videos Table - Core Video Records
    c.execute('''CREATE TABLE IF NOT EXISTS videos (
                 id TEXT PRIMARY KEY,
                 creator_id TEXT,
                 filename TEXT NOT NULL,
                 file_size INTEGER,
                 mime_type TEXT,
                 sha256 TEXT UNIQUE NOT NULL,
                 phash TEXT,
                 credential_id TEXT UNIQUE NOT NULL,
                 manifest TEXT,
                 signature TEXT,
                 status TEXT DEFAULT 'processing',
                 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                 updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                 FOREIGN KEY (creator_id) REFERENCES creators (id)
                 )''')
    
    # Processing Jobs Table - Async Task Tracking
    c.execute('''CREATE TABLE IF NOT EXISTS processing_jobs (
                 id TEXT PRIMARY KEY,
                 video_id TEXT NOT NULL,
                 job_type TEXT NOT NULL,
                 status TEXT DEFAULT 'pending',
                 progress INTEGER DEFAULT 0,
                 error_message TEXT,
                 started_at DATETIME,
                 completed_at DATETIME,
                 FOREIGN KEY (video_id) REFERENCES videos (id)
                 )''')
    
    # Indexes for performance
    c.execute('CREATE INDEX IF NOT EXISTS idx_videos_sha256 ON videos(sha256)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_videos_credential_id ON videos(credential_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_videos_creator ON videos(creator_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_processing_video ON processing_jobs(video_id)')
    
    conn.commit()
    conn.close()

def generate_credential_id() -> str:
    """Generate a unique credential ID following the format: vca_{timestamp}_{uuid_first8}"""
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    unique_id = uuid.uuid4().hex[:8]
    return f"vca_{timestamp}_{unique_id}"

def create_creator(public_key: str, display_name: Optional[str] = None) -> str:
    """Create a new creator identity and return creator ID"""
    creator_id = str(uuid.uuid4())
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    try:
        c.execute("INSERT INTO creators (id, public_key, display_name) VALUES (?, ?, ?)", 
                  (creator_id, public_key, display_name))
        conn.commit()
        logger.info(f"Created new creator: {creator_id} with public key: {public_key[:16]}...")
        return creator_id
    except sqlite3.IntegrityError as e:
        if "UNIQUE constraint failed: creators.public_key" in str(e):
            # Creator already exists, get their ID
            c.execute("SELECT id FROM creators WHERE public_key = ?", (public_key,))
            row = c.fetchone()
            if row:
                logger.info(f"Creator already exists: {row[0]}")
                return row[0]
        raise
    finally:
        conn.close()

def save_video_record(
    creator_id: str, 
    filename: str, 
    file_size: int, 
    mime_type: str,
    sha256: str, 
    phash: str, 
    signature: str, 
    manifest: dict
) -> str:
    """Save a new video record and return the credential ID"""
    video_id = str(uuid.uuid4())
    credential_id = generate_credential_id()
    
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    try:
        c.execute("""INSERT INTO videos 
                     (id, creator_id, filename, file_size, mime_type, sha256, phash, credential_id, manifest, signature, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", 
                  (video_id, creator_id, filename, file_size, mime_type, sha256, phash, credential_id, json.dumps(manifest), signature, 'complete'))
        conn.commit()
        logger.info(f"Saved video record: {credential_id} for file: {filename}")
        return credential_id
    except Exception as e:
        logger.error(f"Failed to save video record: {e}")
        raise
    finally:
        conn.close()

def find_video_by_hash(sha256: str) -> Optional[Dict]:
    """Find exact video match by SHA-256 hash (Hard Binding)"""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("""SELECT v.id, v.filename, v.sha256, v.phash, v.credential_id, v.manifest, v.signature,
                        c.public_key, c.display_name
                 FROM videos v
                 JOIN creators c ON v.creator_id = c.id
                 WHERE v.sha256 = ? AND v.status = 'complete'""", (sha256,))
    row = c.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row[0],
            "filename": row[1],
            "sha256": row[2],
            "phash": row[3],
            "credential_id": row[4],
            "manifest": json.loads(row[5]),
            "signature": row[6],
            "creator_public_key": row[7],
            "creator_name": row[8]
        }
    return None

def find_video_by_phash(phash: str, threshold: int = 15) -> List[Dict]:
    """Find similar videos by pHash with Hamming distance (Soft Binding)"""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("""SELECT v.id, v.filename, v.sha256, v.phash, v.credential_id, v.manifest,
                        c.public_key, c.display_name
                 FROM videos v
                 JOIN creators c ON v.creator_id = c.id
                 WHERE v.status = 'complete'""")
    rows = c.fetchall()
    conn.close()
    
    matches = []
    
    if not phash or phash == "0000000000000000":
        return matches
    
    try:
        import imagehash
        target_hash = imagehash.hex_to_hash(phash)
        
        for row in rows:
            stored_phash_str = row[3]
            if not stored_phash_str or stored_phash_str == "0000000000000000":
                continue
                
            try:
                stored_hash = imagehash.hex_to_hash(stored_phash_str)
                distance = target_hash - stored_hash
                
                if distance < threshold:
                    matches.append({
                        "id": row[0],
                        "filename": row[1],
                        "sha256": row[2],
                        "phash": row[3],
                        "credential_id": row[4],
                        "distance": distance,
                        "creator_public_key": row[6],
                        "creator_name": row[7],
                        "match_type": "exact" if distance == 0 else "similar"
                    })
            except Exception as e:
                logger.warning(f"Could not compare pHash for video {row[0]}: {e}")
                
    except ImportError:
        logger.error("imagehash library not available for pHash comparison")
        
    # Sort by distance (closest matches first)
    matches.sort(key=lambda x: x["distance"])
    return matches

def get_video_by_credential_id(credential_id: str) -> Optional[Dict]:
    """Retrieve video details by credential ID"""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("""SELECT v.id, v.filename, v.sha256, v.phash, v.credential_id, v.manifest, v.signature,
                        v.created_at, c.public_key, c.display_name
                 FROM videos v
                 JOIN creators c ON v.creator_id = c.id
                 WHERE v.credential_id = ?""", (credential_id,))
    row = c.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row[0],
            "filename": row[1],
            "sha256": row[2],
            "phash": row[3],
            "credential_id": row[4],
            "manifest": json.loads(row[5]),
            "signature": row[6],
            "created_at": row[7],
            "creator_public_key": row[8],
            "creator_name": row[9]
        }
    return None

def create_processing_job(video_id: str, job_type: str) -> str:
    """Create a new processing job record"""
    job_id = str(uuid.uuid4())
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    c.execute("INSERT INTO processing_jobs (id, video_id, job_type, status, started_at) VALUES (?, ?, ?, ?, ?)",
              (job_id, video_id, job_type, 'pending', datetime.now(timezone.utc)))
    conn.commit()
    conn.close()
    
    logger.info(f"Created processing job {job_id} for video {video_id}, type: {job_type}")
    return job_id

def update_processing_job(job_id: str, status: str, progress: int = None, error_message: str = None):
    """Update processing job status"""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    if status == 'completed':
        c.execute("UPDATE processing_jobs SET status = ?, progress = 100, completed_at = ? WHERE id = ?",
                  (status, datetime.now(timezone.utc), job_id))
    elif error_message:
        c.execute("UPDATE processing_jobs SET status = ?, error_message = ?, completed_at = ? WHERE id = ?",
                  (status, error_message, datetime.now(timezone.utc), job_id))
    elif progress is not None:
        c.execute("UPDATE processing_jobs SET status = ?, progress = ? WHERE id = ?",
                  (status, progress, job_id))
    else:
        c.execute("UPDATE processing_jobs SET status = ? WHERE id = ?", (status, job_id))
    
    conn.commit()
    conn.close()
    
    logger.info(f"Updated processing job {job_id} to status: {status}")

def get_processing_status(job_id: str) -> Optional[Dict]:
    """Get processing job status"""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT id, video_id, job_type, status, progress, error_message, started_at, completed_at FROM processing_jobs WHERE id = ?", (job_id,))
    row = c.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row[0],
            "video_id": row[1],
            "job_type": row[2],
            "status": row[3],
            "progress": row[4] or 0,
            "error_message": row[5],
            "started_at": row[6],
            "completed_at": row[7]
        }
    return None
