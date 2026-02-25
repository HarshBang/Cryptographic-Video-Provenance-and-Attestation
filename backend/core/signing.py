import nacl.signing
import nacl.encoding
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any

logger = logging.getLogger(__name__)

def generate_key_pair():
    """Generates a new Ed25519 key pair for creator identity (Phase 1 - Identity Layer)."""
    signing_key = nacl.signing.SigningKey.generate()
    verify_key = signing_key.verify_key
    
    private_key_hex = signing_key.encode(encoder=nacl.encoding.HexEncoder).decode('utf-8')
    public_key_hex = verify_key.encode(encoder=nacl.encoding.HexEncoder).decode('utf-8')
    
    logger.info(f"Generated new Ed25519 key pair - Public key: {public_key_hex[:16]}...")
    return private_key_hex, public_key_hex

def sign_message(message: str, private_key_hex: str) -> str:
    """Signs a message using the Ed25519 private key."""
    try:
        signing_key = nacl.signing.SigningKey(private_key_hex, encoder=nacl.encoding.HexEncoder)
        signed = signing_key.sign(message.encode('utf-8'))
        signature_hex = signed.signature.hex()
        logger.info(f"Generated signature: {signature_hex[:16]}...")
        return signature_hex
    except Exception as e:
        logger.error(f"Failed to sign message: {e}")
        raise

def generate_manifest(
    creator_public_key: str,
    asset_info: Dict[str, Any],
    phash_sequence: list,
    timestamp: str | None = None
) -> Dict[str, Any]:
    """Generate a C2PA-style manifest with digital signature (Phase 3 - Manifest Layer)
    
    Args:
        creator_public_key: The creator's public key
        asset_info: Dict containing {'name': filename, 'hash': sha256, 'size': filesize, 'mimetype': mime}
        phash_sequence: List of perceptual hashes from sampled frames
        timestamp: Optional ISO timestamp
    
    Returns:
        Manifest dict with signature field to be populated by sign_message
    """
    
    if not timestamp:
        timestamp = datetime.now(timezone.utc).isoformat()
    
    # Manifest structure following C2PA concepts
    manifest = {
        "version": "1.0",
        "producer": "VCA Provenance System",
        
        # Core Identity Information
        "identity": {
            "creator_pub_key": creator_public_key,
            "algo": "Ed25519"
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
            "sampling_rate": "1 frame per 2 seconds",
            "hash_sequence": phash_sequence,
            "frame_count": len(phash_sequence)
        },
        
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
                        "softwareAgent": "VCA System v1.0"
                    }]
                }
            },
            {
                "label": "vca.integrity",
                "data": {
                    "hard_binding": "SHA-256 hash of original file",
                    "soft_binding": "dHash sequence for robustness against re-encoding"
                }
            }
        ],
        
        # Signature (to be populated)
        "signature": None
    }
    
    logger.info(f"Generated manifest for asset: {asset_info.get('name')} with {len(phash_sequence)} frame hashes")
    return manifest

def verify_signature(manifest: Dict[str, Any], signature: str, public_key_hex: str) -> bool:
    """Verify a signature against a manifest using the creator's public key."""
    try:
        # Remove signature field for verification
        manifest_copy = manifest.copy()
        manifest_copy["signature"] = None
        
        message = json.dumps(manifest_copy, sort_keys=True, separators=(', ', ': '))
        verify_key = nacl.signing.VerifyKey(public_key_hex, encoder=nacl.encoding.HexEncoder)
        verify_key.verify(message.encode('utf-8'), bytes.fromhex(signature))
        return True
    except Exception as e:
        logger.error(f"Signature verification failed: {e}")
        return False