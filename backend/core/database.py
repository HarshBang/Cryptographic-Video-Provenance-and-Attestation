import sqlite3
import json
import logging
import uuid
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)

# DB file stored next to this module
DB_FILE = Path(__file__).resolve().parent.parent / "vca.db"

# Credential ID format: vca_{timestamp}_{uuid_first8}
# Example: vca_20241217_1234abcd

def get_db_connection():
    """Get database connection with foreign keys enabled"""
    conn = sqlite3.connect(DB_FILE)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    
    # Creators Table - Identity Management
    c.execute('''CREATE TABLE IF NOT EXISTS creators (
                 id TEXT PRIMARY KEY,
                 email TEXT UNIQUE,
                 public_key TEXT UNIQUE NOT NULL,
                 private_key TEXT,
                 key_fingerprint TEXT UNIQUE NOT NULL,
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
                 phash_sequence TEXT,
                 credential_id TEXT UNIQUE NOT NULL,
                 manifest TEXT,
                 manifest_hash TEXT,
                 signature TEXT,
                 public_key TEXT,
                 key_fingerprint TEXT,
                 hash_algorithm TEXT DEFAULT 'SHA-256',
                 phash_algorithm TEXT DEFAULT 'dHash',
                 signature_algorithm TEXT DEFAULT 'Ed25519',
                 manifest_version TEXT DEFAULT '1.1',
                 status TEXT DEFAULT 'processing',
                 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                 updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                 sealed_at DATETIME,
                 FOREIGN KEY (creator_id) REFERENCES creators (id),
                 CHECK (status IN ('pending', 'processing', 'complete', 'error', 'sealed'))
                 )''')
    
    # Processing Jobs Table - Async Task Tracking (Phase 2 - Enhanced)
    c.execute('''CREATE TABLE IF NOT EXISTS processing_jobs (
                 id TEXT PRIMARY KEY,
                 video_id TEXT,
                 task_id TEXT UNIQUE NOT NULL,
                 job_type TEXT NOT NULL,
                 status TEXT DEFAULT 'pending',
                 progress INTEGER DEFAULT 0,
                 phase TEXT DEFAULT 'pending',
                 result TEXT,
                 error_message TEXT,
                 started_at DATETIME,
                 completed_at DATETIME,
                 FOREIGN KEY (video_id) REFERENCES videos (id)
                 )''')
    
    conn.commit()
    conn.close()
    
    # Phase 2: Add new columns to existing tables (migration)
    _migrate_database()

def _migrate_database():
    """Add new columns to existing database (Phase 2 migration)"""
    conn = get_db_connection()
    c = conn.cursor()
    
    # Get existing columns in videos table
    c.execute("PRAGMA table_info(videos)")
    existing_columns = [row[1] for row in c.fetchall()]
    
    # Add new columns if they don't exist
    new_columns = {
        'phash_sequence': 'TEXT',
        'manifest_hash': 'TEXT',
        'public_key': 'TEXT',
        'key_fingerprint': 'TEXT',
        'hash_algorithm': "TEXT DEFAULT 'SHA-256'",
        'phash_algorithm': "TEXT DEFAULT 'dHash'",
        'signature_algorithm': "TEXT DEFAULT 'Ed25519'",
        'manifest_version': "TEXT DEFAULT '1.1'",
        'sealed_at': 'DATETIME'
    }
    
    for col_name, col_type in new_columns.items():
        if col_name not in existing_columns:
            try:
                c.execute(f"ALTER TABLE videos ADD COLUMN {col_name} {col_type}")
                print(f"Added column: {col_name}")
            except sqlite3.OperationalError as e:
                print(f"Column {col_name} may already exist: {e}")
    
    # Get existing columns in creators table
    c.execute("PRAGMA table_info(creators)")
    existing_creator_columns = [row[1] for row in c.fetchall()]
    
    if 'private_key' not in existing_creator_columns:
        try:
            c.execute("ALTER TABLE creators ADD COLUMN private_key TEXT")
            print("Added column: creators.private_key")
        except sqlite3.OperationalError as e:
            print(f"Column private_key issue: {e}")

    if 'email' not in existing_creator_columns:
        try:
            c.execute("ALTER TABLE creators ADD COLUMN email TEXT")
            print("Added column: creators.email")
        except sqlite3.OperationalError as e:
            print(f"Column email issue: {e}")
            
    if 'key_fingerprint' not in existing_creator_columns:
        try:
            # Add without UNIQUE constraint first, then update existing rows
            c.execute("ALTER TABLE creators ADD COLUMN key_fingerprint TEXT")
            print("Added column: creators.key_fingerprint")
            
            # Update existing rows with computed fingerprints
            c.execute("SELECT id, public_key FROM creators WHERE key_fingerprint IS NULL")
            rows = c.fetchall()
            for row in rows:
                creator_id, public_key = row
                fingerprint = compute_key_fingerprint(public_key)
                c.execute("UPDATE creators SET key_fingerprint = ? WHERE id = ?", (fingerprint, creator_id))
            
            print(f"Updated {len(rows)} existing creators with fingerprints")
        except sqlite3.OperationalError as e:
            print(f"Column key_fingerprint issue: {e}")
    
    # Get existing columns in processing_jobs table
    c.execute("PRAGMA table_info(processing_jobs)")
    existing_job_columns = [row[1] for row in c.fetchall()]
    
    job_new_columns = {
        'task_id': 'TEXT UNIQUE',
        'phase': "TEXT DEFAULT 'pending'",
        'result': 'TEXT'
    }
    
    for col_name, col_type in job_new_columns.items():
        if col_name not in existing_job_columns:
            try:
                c.execute(f"ALTER TABLE processing_jobs ADD COLUMN {col_name} {col_type}")
                print(f"Added column: {col_name}")
            except sqlite3.OperationalError as e:
                print(f"Column {col_name} may already exist: {e}")
    
    # Create indexes (ignore if they already exist)
    indexes = [
        ('idx_videos_sha256', 'videos(sha256)'),
        ('idx_videos_credential_id', 'videos(credential_id)'),
        ('idx_videos_creator', 'videos(creator_id)'),
        ('idx_videos_manifest_hash', 'videos(manifest_hash)'),
        ('idx_processing_video', 'processing_jobs(video_id)'),
        ('idx_processing_task', 'processing_jobs(task_id)')
    ]
    
    for idx_name, idx_cols in indexes:
        try:
            c.execute(f'CREATE INDEX IF NOT EXISTS {idx_name} ON {idx_cols}')
        except sqlite3.OperationalError:
            pass
    
    conn.commit()
    conn.close()

def generate_credential_id() -> str:
    """Generate a unique credential ID following the format: vca_{timestamp}_{uuid_first8}"""
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    unique_id = uuid.uuid4().hex[:8]
    return f"vca_{timestamp}_{unique_id}"

def compute_key_fingerprint(public_key: str) -> str:
    """Compute SHA-256 fingerprint of public key"""
    return hashlib.sha256(public_key.encode('utf-8')).hexdigest()

def create_creator(public_key: str, display_name: Optional[str] = None, explicit_id: Optional[str] = None, private_key: Optional[str] = None, email: Optional[str] = None) -> str:
    """Create a new creator identity and return creator ID"""
    creator_id = explicit_id if explicit_id else str(uuid.uuid4())
    key_fingerprint = compute_key_fingerprint(public_key)
    conn = get_db_connection()
    c = conn.cursor()
    
    try:
        c.execute("INSERT INTO creators (id, email, public_key, private_key, key_fingerprint, display_name) VALUES (?, ?, ?, ?, ?, ?)", 
                  (creator_id, email, public_key, private_key, key_fingerprint, display_name))
        conn.commit()
        logger.info(f"Created new creator: {creator_id} with fingerprint: {key_fingerprint[:16]}...")
        return creator_id
    except sqlite3.IntegrityError as e:
        if "UNIQUE constraint failed" in str(e):
            c.execute("SELECT id FROM creators WHERE public_key = ? OR key_fingerprint = ? OR id = ?", (public_key, key_fingerprint, creator_id))
            row = c.fetchone()
            if row:
                logger.info(f"Creator already exists: {row[0]}")
                if display_name:
                    c.execute("UPDATE creators SET display_name = ? WHERE id = ?", (display_name, row[0]))
                    conn.commit()
                return row[0]
        raise
    finally:
        conn.close()

def get_creator(creator_id: str) -> Optional[Dict]:
    """Retrieve creator details, including private key"""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT id, public_key, private_key, key_fingerprint, display_name FROM creators WHERE id = ?", (creator_id,))
    row = c.fetchone()
    conn.close()
    if row:
        return {
            "id": row[0],
            "public_key": row[1],
            "private_key": row[2],
            "key_fingerprint": row[3],
            "display_name": row[4]
        }
    return None

def save_video_record(
    creator_id: str, 
    filename: str, 
    file_size: int, 
    mime_type: str,
    sha256: str, 
    phash: str,
    phash_sequence: List[str],
    signature: str, 
    manifest: dict,
    manifest_hash: str,
    public_key: str,
    status: str = 'complete'
) -> str:
    """Save a new video record and return the credential ID"""
    video_id = str(uuid.uuid4())
    credential_id = generate_credential_id()
    key_fingerprint = compute_key_fingerprint(public_key) if public_key else None
    
    conn = get_db_connection()
    c = conn.cursor()
    
    try:
        c.execute("""INSERT INTO videos 
                     (id, creator_id, filename, file_size, mime_type, sha256, phash, phash_sequence, 
                      credential_id, manifest, manifest_hash, signature, public_key, key_fingerprint, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", 
                  (video_id, creator_id, filename, file_size, mime_type, sha256, phash, 
                   json.dumps(phash_sequence), credential_id, json.dumps(manifest), manifest_hash, 
                   signature, public_key, key_fingerprint, status))
        conn.commit()
        logger.info(f"Saved video record: {credential_id} for file: {filename}")
        return credential_id
    except Exception as e:
        logger.error(f"Failed to save video record: {e}")
        raise
    finally:
        conn.close()

def create_unsigned_video_record(
    filename: str, 
    file_size: int, 
    mime_type: str,
    sha256: str, 
    phash: str,
    phash_sequence: List[str]
) -> tuple:
    """Create an unsigned video record and return (video_id, credential_id)"""
    video_id = str(uuid.uuid4())
    credential_id = generate_credential_id()
    
    conn = get_db_connection()
    c = conn.cursor()
    
    try:
        c.execute("""INSERT INTO videos 
                     (id, filename, file_size, mime_type, sha256, phash, phash_sequence, 
                      credential_id, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""", 
                  (video_id, filename, file_size, mime_type, sha256, phash, 
                   json.dumps(phash_sequence), credential_id, 'pending'))
        conn.commit()
        logger.info(f"Created unsigned video record: {credential_id} for file: {filename}")
        return video_id, credential_id
    except Exception as e:
        logger.error(f"Failed to create unsigned video record: {e}")
        raise
    finally:
        conn.close()

def finalize_video_signature(
    credential_id: str,
    creator_id: str,
    manifest: dict,
    manifest_hash: str,
    signature: str,
    public_key: str
) -> bool:
    """Finalize video record with signature - Phase 2 Client-Side Signing"""
    key_fingerprint = compute_key_fingerprint(public_key)
    sealed_at = datetime.now(timezone.utc).isoformat()
    
    conn = get_db_connection()
    c = conn.cursor()
    
    try:
        c.execute("""UPDATE videos 
                     SET creator_id = ?, manifest = ?, manifest_hash = ?, signature = ?, 
                         public_key = ?, key_fingerprint = ?, status = 'sealed', sealed_at = ?
                     WHERE credential_id = ?""", 
                  (creator_id, json.dumps(manifest), manifest_hash, signature, 
                   public_key, key_fingerprint, sealed_at, credential_id))
        conn.commit()
        
        if c.rowcount == 0:
            logger.error(f"No video record found for credential_id: {credential_id}")
            return False
            
        logger.info(f"Finalized video signature: {credential_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to finalize video signature: {e}")
        raise
    finally:
        conn.close()

def find_video_by_sha256(sha256: str) -> Optional[Dict]:
    """Find video by SHA-256 hash - returns None if not found or multiple found"""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("""SELECT v.id, v.credential_id, v.status
                 FROM videos v
                 WHERE v.sha256 = ?""", (sha256,))
    rows = c.fetchall()
    conn.close()
    
    if len(rows) == 1:
        return {"id": rows[0][0], "credential_id": rows[0][1], "status": rows[0][2]}
    return None

def find_video_by_hash(sha256: str) -> Optional[Dict]:
    """Find exact video match by SHA-256 hash (Hard Binding)"""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("""SELECT v.id, v.filename, v.sha256, v.phash, v.phash_sequence, v.credential_id, 
                        v.manifest, v.manifest_hash, v.signature, v.public_key, v.key_fingerprint,
                        v.hash_algorithm, v.phash_algorithm, v.signature_algorithm, v.manifest_version,
                        v.sealed_at, c.display_name
                 FROM videos v
                 LEFT JOIN creators c ON v.creator_id = c.id
                 WHERE v.sha256 = ? AND v.status IN ('complete', 'sealed')""", (sha256,))
    row = c.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row[0],
            "filename": row[1],
            "sha256": row[2],
            "phash": row[3],
            "phash_sequence": json.loads(row[4]) if row[4] else [],
            "credential_id": row[5],
            "manifest": json.loads(row[6]) if row[6] else None,
            "manifest_hash": row[7],
            "signature": row[8],
            "public_key": row[9],
            "key_fingerprint": row[10],
            "hash_algorithm": row[11],
            "phash_algorithm": row[12],
            "signature_algorithm": row[13],
            "manifest_version": row[14],
            "sealed_at": row[15],
            "creator_name": row[16]
        }
    return None

def find_video_by_phash(phash: str, phash_sequence: List[str] = None, threshold: int = 15) -> List[Dict]:
    """Find similar videos by pHash with weighted Hamming distance (Soft Binding) - Phase 2 Enhanced"""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("""SELECT v.id, v.filename, v.sha256, v.phash, v.phash_sequence, v.credential_id, v.manifest,
                        v.signature, v.public_key, v.key_fingerprint, v.sealed_at, c.display_name
                 FROM videos v
                 LEFT JOIN creators c ON v.creator_id = c.id
                 WHERE v.status IN ('complete', 'sealed')""")
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
            stored_sequence_str = row[4]
            
            if not stored_phash_str or stored_phash_str == "0000000000000000":
                continue
                
            try:
                stored_hash = imagehash.hex_to_hash(stored_phash_str)
                primary_distance = target_hash - stored_hash
                
                # Phase 2: Multi-frame similarity scoring
                weighted_distance = primary_distance
                if phash_sequence and stored_sequence_str:
                    stored_sequence = json.loads(stored_sequence_str)
                    if len(stored_sequence) > 1 and len(phash_sequence) > 1:
                        # Calculate average Hamming distance across matching frames
                        distances = []
                        for i, h1 in enumerate(phash_sequence[:min(len(phash_sequence), len(stored_sequence))]):
                            try:
                                hash1 = imagehash.hex_to_hash(h1)
                                hash2 = imagehash.hex_to_hash(stored_sequence[i])
                                distances.append(hash1 - hash2)
                            except:
                                continue
                        if distances:
                            # Weighted average: 60% primary, 40% sequence average
                            avg_distance = sum(distances) / len(distances)
                            weighted_distance = (primary_distance * 0.6) + (avg_distance * 0.4)
                
                if weighted_distance < threshold:
                    matches.append({
                        "id": row[0],
                        "filename": row[1],
                        "sha256": row[2],
                        "phash": row[3],
                        "phash_sequence": json.loads(row[4]) if row[4] else [],
                        "credential_id": row[5],
                        "manifest": json.loads(row[6]) if row[6] else None,
                        "signature": row[7],
                        "public_key": row[8],
                        "key_fingerprint": row[9],
                        "sealed_at": row[10],
                        "creator_name": row[11],
                        "distance": weighted_distance,
                        "match_type": "exact" if primary_distance == 0 else "similar"
                    })
            except Exception as e:
                logger.warning(f"Could not compare pHash for video {row[0]}: {e}")
                
    except ImportError:
        logger.error("imagehash library not available for pHash comparison")
        
    # Sort by distance (closest matches first)
    matches.sort(key=lambda x: x["distance"])
    return matches

def list_videos(creator_id: str = None, limit: int = 50, offset: int = 0) -> List[Dict]:
    """List all signed videos for dashboard - Phase 2"""
    conn = get_db_connection()
    c = conn.cursor()
    
    query = """SELECT v.id, v.filename, v.file_size, v.sha256, v.credential_id, 
                      v.manifest, v.manifest_hash, v.signature, v.public_key, 
                      v.key_fingerprint, v.sealed_at, v.created_at, c.display_name
               FROM videos v
               LEFT JOIN creators c ON v.creator_id = c.id
               WHERE v.status = 'sealed'"""
               
    params = []
    if creator_id:
        query += " AND v.creator_id = ?"
        params.append(creator_id)
        
    query += " ORDER BY v.sealed_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    
    c.execute(query, tuple(params))
    rows = c.fetchall()
    conn.close()
    
    videos = []
    for row in rows:
        videos.append({
            "id": row[0],
            "filename": row[1],
            "file_size": row[2],
            "sha256": row[3],
            "credential_id": row[4],
            "manifest": json.loads(row[5]) if row[5] else None,
            "manifest_hash": row[6],
            "signature": row[7],
            "public_key": row[8],
            "key_fingerprint": row[9],
            "sealed_at": row[10],
            "created_at": row[11],
            "creator_name": row[12]
        })
    return videos

def get_video_by_credential_id(credential_id: str) -> Optional[Dict]:
    """Retrieve video details by credential ID - Phase 2 Enhanced"""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("""SELECT v.id, v.filename, v.sha256, v.phash, v.phash_sequence, v.credential_id, 
                        v.manifest, v.manifest_hash, v.signature, v.public_key, v.key_fingerprint,
                        v.hash_algorithm, v.phash_algorithm, v.signature_algorithm, v.manifest_version,
                        v.created_at, v.sealed_at, c.display_name
                 FROM videos v
                 LEFT JOIN creators c ON v.creator_id = c.id
                 WHERE v.credential_id = ?""", (credential_id,))
    row = c.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row[0],
            "filename": row[1],
            "sha256": row[2],
            "phash": row[3],
            "phash_sequence": json.loads(row[4]) if row[4] else [],
            "credential_id": row[5],
            "manifest": json.loads(row[6]) if row[6] else None,
            "manifest_hash": row[7],
            "signature": row[8],
            "public_key": row[9],
            "key_fingerprint": row[10],
            "hash_algorithm": row[11],
            "phash_algorithm": row[12],
            "signature_algorithm": row[13],
            "manifest_version": row[14],
            "created_at": row[15],
            "sealed_at": row[16],
            "creator_name": row[17]
        }
    return None

def create_processing_job(task_id: str, job_type: str, video_id: str = None) -> str:
    """Create a new processing job record - Phase 2 with task_id"""
    job_id = str(uuid.uuid4())
    conn = get_db_connection()
    c = conn.cursor()
    
    c.execute("""INSERT INTO processing_jobs 
                 (id, task_id, video_id, job_type, status, phase, started_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)""",
              (job_id, task_id, video_id, job_type, 'pending', 'pending', datetime.now(timezone.utc)))
    conn.commit()
    conn.close()
    
    logger.info(f"Created processing job {job_id} with task {task_id}, type: {job_type}")
    return job_id

def update_processing_job(task_id: str, status: str, progress: int = None, 
                          phase: str = None, result: dict = None, error_message: str = None):
    """Update processing job status - Phase 2 Enhanced"""
    conn = get_db_connection()
    c = conn.cursor()
    
    updates = []
    params = []
    
    if status:
        updates.append("status = ?")
        params.append(status)
    if progress is not None:
        updates.append("progress = ?")
        params.append(progress)
    if phase:
        updates.append("phase = ?")
        params.append(phase)
    if result is not None:
        updates.append("result = ?")
        params.append(json.dumps(result))
    if error_message:
        updates.append("error_message = ?")
        params.append(error_message)
    
    if status in ('completed', 'error', 'complete'):
        updates.append("completed_at = ?")
        params.append(datetime.now(timezone.utc).isoformat())
    
    params.append(task_id)
    
    query = f"UPDATE processing_jobs SET {', '.join(updates)} WHERE task_id = ?"
    c.execute(query, params)
    conn.commit()
    conn.close()
    
    logger.info(f"Updated processing job with task {task_id} to status: {status}, phase: {phase}")

def get_processing_status(task_id: str) -> Optional[Dict]:
    """Get processing job status by task_id - Phase 2"""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("""SELECT id, task_id, video_id, job_type, status, progress, phase, result,
                        error_message, started_at, completed_at 
                 FROM processing_jobs WHERE task_id = ?""", (task_id,))
    row = c.fetchone()
    conn.close()
    
    if row:
        return {
            "id": row[0],
            "task_id": row[1],
            "video_id": row[2],
            "job_type": row[3],
            "status": row[4],
            "progress": row[5] or 0,
            "phase": row[6],
            "result": json.loads(row[7]) if row[7] else None,
            "error_message": row[8],
            "started_at": row[9],
            "completed_at": row[10]
        }
    return None

def link_job_to_video(task_id: str, video_id: str):
    """Link a processing job to a video record after creation"""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("UPDATE processing_jobs SET video_id = ? WHERE task_id = ?", (video_id, task_id))
    conn.commit()
    conn.close()

def delete_unsealed_video(video_id: str):
    """Delete an unsealed video and its associated processing jobs to allow re-upload"""
    conn = get_db_connection()
    c = conn.cursor()
    try:
        c.execute("DELETE FROM processing_jobs WHERE video_id = ?", (video_id,))
        c.execute("DELETE FROM videos WHERE id = ?", (video_id,))
        conn.commit()
        logger.info(f"Deleted unsealed/abandoned video record {video_id} to clear SHA-256 conflict")
    except Exception as e:
        logger.error(f"Failed to delete unsealed video {video_id}: {e}")
        conn.rollback()
    finally:
        conn.close()
