import hashlib
import imagehash
from PIL import Image
import cv2
import logging
from typing import List

logger = logging.getLogger(__name__)

def calculate_sha256(file_path: str) -> str:
    """Phase 1 - Hard Binding: Calculates the SHA-256 hash of a file for exact integrity verification.
    
    This provides the "hard binding" that detects any bit-level changes to the original file.
    """
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    hash_hex = sha256_hash.hexdigest()
    logger.info(f"SHA-256 calculated: {hash_hex[:16]}... for file: {file_path}")
    return hash_hex

def calculate_phash_sequence(file_path: str, frame_interval: int = 48) -> List[str]:
    """Phase 1 - Soft Binding: Calculates a sequence of perceptual hashes for robustness.
    
    Implements sparse frame sampling to handle "The Instagram Problem" (compression/stripping).
    
    Args:
        file_path: Path to the video file
        frame_interval: Number of frames between samples (default: 48 frames ≈ 2 seconds at 24fps)
    
    Returns:
        List of dHash strings from sampled frames
    """
    cap = cv2.VideoCapture(file_path)
    if not cap.isOpened():
        logger.warning(f"Could not open video file: {file_path}")
        return []

    hashes = []
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    if fps == 0: 
        fps = 24  # Fallback
        logger.info(f"FPS not detected, using fallback: {fps}")
    
    logger.info(f"Processing video: {total_frames} frames at {fps}fps, sampling every {frame_interval} frames")
    
    frame_count = 0
    sampled_count = 0
    
    while True:
        success, frame = cap.read()
        if not success:
            break
            
        # Sample frames at regular intervals
        if frame_count % frame_interval == 0:
            try:
                # Convert BGR to RGB
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                # Convert to PIL Image
                pil_image = Image.fromarray(rgb_frame)
                # Calculate dHash (more robust than pHash for our use case)
                dhash = imagehash.dhash(pil_image, hash_size=8)
                hashes.append(str(dhash))
                sampled_count += 1
                
                if sampled_count % 10 == 0:  # Log progress every 10 samples
                    logger.info(f"Sampled {sampled_count} frames so far...")
            except Exception as e:
                logger.warning(f"Error processing frame {frame_count}: {e}")
                
        frame_count += 1
        
        # Limit to reasonable number of samples (max 50 frames)
        if sampled_count >= 50:
            break
            
    cap.release()
    
    logger.info(f"Generated pHash sequence: {len(hashes)} frames sampled from {frame_count} total frames")
    return hashes

def calculate_single_phash(file_path: str) -> str:
    """Calculate a single representative pHash (for backward compatibility)."""
    hashes = calculate_phash_sequence(file_path, frame_interval=1000)  # Sample very sparsely
    return hashes[0] if hashes else "0000000000000000"

