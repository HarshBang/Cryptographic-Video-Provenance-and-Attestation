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

def calculate_phash_sequence(file_path: str, sampling_interval_seconds: float = 2.0, max_samples: int = 50) -> List[str]:
    """
    Phase 2 - Soft Binding: Calculates a sequence of perceptual hashes for robustness.
    
    Implements time-based sparse frame sampling to handle "The Instagram Problem" (compression/stripping).
    
    Args:
        file_path: Path to the video file
        sampling_interval_seconds: Time between samples in seconds (default: 2.0)
        max_samples: Maximum number of frames to sample (default: 50)
    
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
    duration_seconds = total_frames / fps if fps > 0 else 0
    
    if fps == 0: 
        fps = 24  # Fallback
        logger.info(f"FPS not detected, using fallback: {fps}")
    
    # Phase 2: Time-based sampling calculation
    frame_interval = int(fps * sampling_interval_seconds)
    if frame_interval < 1:
        frame_interval = 1  # Ensure at least 1 frame
    
    logger.info(f"Processing video: {total_frames} frames at {fps:.2f}fps, duration: {duration_seconds:.1f}s")
    logger.info(f"Time-based sampling: every {sampling_interval_seconds}s ({frame_interval} frames), max {max_samples} samples")
    
    frame_count = 0
    sampled_count = 0
    
    while True:
        success, frame = cap.read()
        if not success:
            break
            
        # Phase 2: Time-based sampling
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
        
        # Phase 2: Limit to max_samples
        if sampled_count >= max_samples:
            break
            
    cap.release()
    
    # Phase 2: Ensure at least one hash for very short videos
    if not hashes and total_frames > 0:
        logger.warning(f"No frames sampled, attempting fallback for short video")
        cap = cv2.VideoCapture(file_path)
        success, frame = cap.read()
        if success:
            try:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(rgb_frame)
                dhash = imagehash.dhash(pil_image, hash_size=8)
                hashes.append(str(dhash))
                logger.info("Fallback: sampled first frame for short video")
            except Exception as e:
                logger.error(f"Fallback sampling failed: {e}")
        cap.release()
    
    logger.info(f"Generated pHash sequence: {len(hashes)} frames sampled from {frame_count} total frames")
    return hashes

def calculate_single_phash(file_path: str) -> str:
    """Calculate a single representative pHash (for backward compatibility)."""
    hashes = calculate_phash_sequence(file_path, sampling_interval_seconds=10.0, max_samples=1)
    return hashes[0] if hashes else "0000000000000000"

def calculate_hamming_distance(hash1: str, hash2: str) -> int:
    """Calculate Hamming distance between two hash strings."""
    try:
        import imagehash
        h1 = imagehash.hex_to_hash(hash1)
        h2 = imagehash.hex_to_hash(hash2)
        return h1 - h2
    except Exception as e:
        logger.error(f"Error calculating Hamming distance: {e}")
        return 999  # Return large distance on error

def calculate_sequence_similarity(seq1: List[str], seq2: List[str]) -> float:
    """
    Phase 2 - Calculate weighted similarity between two pHash sequences.
    Returns similarity percentage (0-100).
    """
    if not seq1 or not seq2:
        return 0.0
    
    min_len = min(len(seq1), len(seq2))
    if min_len == 0:
        return 0.0
    
    distances = []
    for i in range(min_len):
        try:
            import imagehash
            h1 = imagehash.hex_to_hash(seq1[i])
            h2 = imagehash.hex_to_hash(seq2[i])
            distances.append(h1 - h2)
        except Exception as e:
            logger.warning(f"Error comparing frame {i}: {e}")
            distances.append(64)  # Max distance for 8x8 hash
    
    if not distances:
        return 0.0
    
    # Calculate weighted average (earlier frames weighted more)
    weights = [1.0 / (i + 1) for i in range(len(distances))]
    weighted_sum = sum(d * w for d, w in zip(distances, weights))
    total_weight = sum(weights)
    avg_distance = weighted_sum / total_weight if total_weight > 0 else 0
    
    # Convert to similarity percentage (max distance for 8x8 hash is 64)
    similarity = max(0, 100 - (avg_distance * 100 / 64))
    return similarity

