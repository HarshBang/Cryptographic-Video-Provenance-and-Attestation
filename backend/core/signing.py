import nacl.signing
import nacl.encoding
import hashlib
import json
import logging
import copy
from datetime import datetime, timezone
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Phase 2 - Canonical JSON Rules
# - UTF-8 encoding
# - Sorted keys
# - No whitespace
# - separators=(',', ':')
# - Signature excludes "signature" field

def generate_key_pair():
    """Generates a new Ed25519 key pair for creator identity (Phase 2)."""
    signing_key = nacl.signing.SigningKey.generate()
    verify_key = signing_key.verify_key
    
    # Return base64 encoded keys for tweetnacl compatibility
    private_key_b64 = signing_key.encode(encoder=nacl.encoding.Base64Encoder).decode('utf-8')
    public_key_b64 = verify_key.encode(encoder=nacl.encoding.Base64Encoder).decode('utf-8')
    
    logger.info(f"Generated new Ed25519 key pair - Public key: {public_key_b64[:16]}...")
    return private_key_b64, public_key_b64

def canonical_json_encode(data: Dict[str, Any]) -> str:
    """
    Phase 2 - Canonical JSON Serialization
    Rules:
    - UTF-8 encoding
    - Sorted keys (alphabetical)
    - No whitespace
    - separators=(',', ':')
    - Deterministic output
    """
    return json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False)

def compute_manifest_hash(manifest: Dict[str, Any]) -> str:
    """
    Phase 2 - Compute manifest hash for forensic strength
    Hash of canonical JSON without signature field
    """
    manifest_copy = copy.deepcopy(manifest)
    # Remove signature field for hash computation
    manifest_copy.pop('signature', None)
    canonical = canonical_json_encode(manifest_copy)
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()

def sign_message(message_bytes: bytes, private_key_b64: str) -> str:
    """
    Phase 2 - Sign message bytes using Ed25519 private key.
    Accepts base64-encoded private key (tweetnacl compatible).
    Returns base64-encoded signature.
    """
    try:
        signing_key = nacl.signing.SigningKey(private_key_b64, encoder=nacl.encoding.Base64Encoder)
        signed = signing_key.sign(message_bytes)
        signature_b64 = nacl.encoding.Base64Encoder.encode(signed.signature).decode('utf-8')
        logger.info(f"Generated signature: {signature_b64[:16]}...")
        return signature_b64
    except Exception as e:
        logger.error(f"Failed to sign message: {e}")
        raise

def verify_signature_detached(message_bytes: bytes, signature_b64: str, public_key_b64: str) -> bool:
    """
    Phase 2 - Verify detached signature using Ed25519 public key.
    Accepts base64-encoded signature and public key (tweetnacl compatible).
    """
    try:
        verify_key = nacl.signing.VerifyKey(public_key_b64, encoder=nacl.encoding.Base64Encoder)
        signature_bytes = nacl.encoding.Base64Encoder.decode(signature_b64.encode('utf-8'))
        verify_key.verify(message_bytes, signature_bytes)
        logger.info("Signature verification successful")
        return True
    except Exception as e:
        logger.error(f"Signature verification failed: {e}")
        return False

def generate_manifest(
    creator_public_key: str,
    asset_info: Dict[str, Any],
    phash_sequence: list,
    manifest_hash: str,
    timestamp: str | None = None
) -> Dict[str, Any]:
    """
    Phase 2 - Generate a C2PA-style manifest with digital signature
    
    Args:
        creator_public_key: The creator's public key (base64 encoded)
        asset_info: Dict containing {'name': filename, 'hash': sha256, 'size': filesize, 'mimetype': mime}
        phash_sequence: List of perceptual hashes from sampled frames
        manifest_hash: Pre-computed manifest hash for signing
        timestamp: Optional ISO timestamp
    
    Returns:
        Manifest dict (v1.1 Phase 2 format)
    """
    
    if not timestamp:
        timestamp = datetime.now(timezone.utc).isoformat()
    
    # Phase 2 Manifest structure (v1.1)
    manifest = {
        "version": "1.1",
        "manifest_version": "1.1",
        "producer": "VCA Provenance System",
        
        # Core Identity Information
        "identity": {
            "creator_pub_key": creator_public_key,
            "algorithm": "Ed25519",
            "key_fingerprint": hashlib.sha256(creator_public_key.encode('utf-8')).hexdigest()[:16]
        },
        
        # Asset Information (Hard Binding)
        "asset": {
            "name": asset_info.get("name", "unknown"),
            "sha256": asset_info.get("hash", ""),
            "size": asset_info.get("size", 0),
            "mimetype": asset_info.get("mimetype", "video/mp4")
        },
        
        # Soft Binding (Perceptual Hash Sequence)
        "perceptual_signature": {
            "algorithm": "dHash",
            "algorithm_version": "1.0",
            "sampling_rate": "1 frame per 2 seconds",
            "hash_sequence": phash_sequence,
            "frame_count": len(phash_sequence)
        },
        
        # Algorithm Versions
        "algorithms": {
            "hash": "SHA-256",
            "signature": "Ed25519",
            "perceptual": "dHash"
        },
        
        # Manifest Hash (for forensic verification)
        "manifest_hash": manifest_hash,
        
        # Timestamp
        "timestamp": timestamp,
        
        # Assertions (C2PA-style)
        "assertions": [
            {
                "label": "vca.actions",
                "data": {
                    "actions": [{
                        "action": "vca.created",
                        "when": timestamp,
                        "softwareAgent": "VCA System Phase 2"
                    }]
                }
            },
            {
                "label": "vca.integrity",
                "data": {
                    "hard_binding": "SHA-256 hash of original file",
                    "soft_binding": "dHash sequence for robustness against re-encoding",
                    "manifest_hash": manifest_hash
                }
            }
        ],
        
        # Signature (to be populated by client)
        "signature": None
    }
    
    logger.info(f"Generated manifest v1.1 for asset: {asset_info.get('name')} with {len(phash_sequence)} frame hashes")
    return manifest

def verify_manifest_signature(manifest: Dict[str, Any], signature_b64: str, public_key_b64: str) -> bool:
    """
    Phase 2 - Verify a signature against a manifest using the creator's public key.
    Uses canonical JSON serialization.
    """
    try:
        # Create deep copy and remove signature field for verification
        manifest_copy = copy.deepcopy(manifest)
        manifest_copy.pop("signature", None)
        
        # Canonical JSON encoding
        message = canonical_json_encode(manifest_copy)
        message_bytes = message.encode('utf-8')
        
        return verify_signature_detached(message_bytes, signature_b64, public_key_b64)
    except Exception as e:
        logger.error(f"Manifest signature verification failed: {e}")
        return False

def verify_stored_signature(video_record: Dict[str, Any]) -> bool:
    """
    Phase 2 - Re-verify a stored signature against stored manifest.
    Used for tamper detection on retrieval.
    """
    try:
        manifest = video_record.get("manifest")
        signature = video_record.get("signature")
        public_key = video_record.get("public_key")
        
        if not manifest or not signature or not public_key:
            logger.warning("Missing data for signature verification")
            return False
        
        # Recompute manifest hash and compare
        stored_hash = manifest.get("manifest_hash")
        computed_hash = compute_manifest_hash(manifest)
        
        if stored_hash != computed_hash:
            logger.error("Manifest hash mismatch - possible tampering detected")
            return False
        
        # Verify signature
        return verify_manifest_signature(manifest, signature, public_key)
    except Exception as e:
        logger.error(f"Stored signature verification failed: {e}")
        return False