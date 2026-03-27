import os
from dotenv import load_dotenv
from typing import Optional
from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, jwk
from jose.utils import base64url_decode
import requests
import time

load_dotenv()

security = HTTPBearer()

# AWS Cognito Configuration
COGNITO_REGION = os.getenv("COGNITO_REGION", "ap-south-1") # Change if needed
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
# Cache for JWKS to avoid repeated fetch
_jwks_cache = None
_jwks_cache_time = 0

def get_jwks() -> dict:
    global _jwks_cache, _jwks_cache_time
    if _jwks_cache and (time.time() - _jwks_cache_time) < 3600:
        return _jwks_cache
    
    # Reload from env in case it changed
    region = os.getenv("COGNITO_REGION", "ap-south-1")
    pool_id = os.getenv("COGNITO_USER_POOL_ID", "")
    jwks_url = f"https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/jwks.json"
    
    try:
        response = requests.get(jwks_url, timeout=10)
        response.raise_for_status()
        _jwks_cache = response.json()
        _jwks_cache_time = time.time()
        return _jwks_cache
    except Exception as e:
        print(f"Failed to fetch JWKS from Cognito: {e}")
        return {}

def verify_token(token: str) -> dict:
    jwks = get_jwks()
    if not jwks:
        raise HTTPException(status_code=500, detail="Could not fetch Cognito JWKS keys")

    try:
        # Get unverified headers to extract kid
        headers = jwt.get_unverified_headers(token)
        kid = headers.get('kid')
        
        # Find matching key in JWKS
        key_index = -1
        for i in range(len(jwks['keys'])):
            if kid == jwks['keys'][i]['kid']:
                key_index = i
                break
                
        if key_index == -1:
            raise HTTPException(status_code=401, detail="Public key not found in jwks.json")
            
        # Verify and decode the token
        public_key = jwk.construct(jwks['keys'][key_index])
        message, encoded_signature = token.rsplit('.', 1)
        decoded_signature = base64url_decode(encoded_signature.encode('utf-8'))
        
        if not public_key.verify(message.encode('utf-8'), decoded_signature):
            raise HTTPException(status_code=401, detail="Signature verification failed")
            
        claims = jwt.get_unverified_claims(token)
        
        # Verify standard claims
        if time.time() > claims.get('exp', 0):
            raise HTTPException(status_code=401, detail="Token is expired")
            
        app_client_id = os.getenv("COGNITO_APP_CLIENT_ID", "")
        if claims.get('aud') != app_client_id and claims.get('client_id') != app_client_id:
            raise HTTPException(status_code=401, detail="Token was not issued for this audience")
            
        return claims
    except jwt.JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Token: {e}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication error: {e}")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    """FastAPI Dependency for extracting current user from AWS Cognito Token"""
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization credentials")
        
    claims = verify_token(credentials.credentials)
    
    import hashlib

    # Try to get email — may be missing for federated (Google) users
    email = claims.get('email', '')
    
    if not email:
        # For Google federated users, extract email from identities array
        identities = claims.get('identities', [])
        if identities and isinstance(identities, list):
            email = identities[0].get('userId', '')  # Google userId is the email for some configs
        
        # Last resort: use sub as stable identity (still consistent per auth method)
        # but derive from cognito:username which strips the provider prefix
        if not email:
            cognito_username = claims.get('cognito:username', '')
            # cognito:username for Google is "google_<googleId>" — use sub instead
            # sub is consistent for the same Google account across sessions
            sub = claims.get('sub', '')
            if not sub:
                raise HTTPException(status_code=401, detail="Token missing identity claims")
            # Use sub as fallback — note this won't merge with email/password accounts
            # but is stable for the same Google account
            stable_id = hashlib.sha256(sub.encode()).hexdigest()[:36]
            return {
                "id": stable_id,
                "email": cognito_username,  # best available identifier
                "name": claims.get('name', ''),
                "creator_type": claims.get('custom:creator_type', 'independent')
            }

    # Derive stable ID from email (consistent across Google + email/password for same email)
    stable_id = hashlib.sha256(email.lower().encode()).hexdigest()[:36]

    return {
        "id": stable_id,
        "email": email,
        "name": claims.get('name', ''),
        "creator_type": claims.get('custom:creator_type', 'independent')
    }
