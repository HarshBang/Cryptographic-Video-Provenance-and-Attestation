"""Simple test for Phase 1 implementation"""
import requests
import json
import time

API_BASE = "http://localhost:8000/api"
VIDEO_PATH = "e:/NMIMS/Sem 8/VCA/Screen Recording 2025-04-04 104451.mp4"

print("🚀 VCA Phase 1 - Simple Test\n")

# Test 1: Health
print("1. Health Check...")
try:
    r = requests.get(f"{API_BASE}/health", timeout=5)
    print(f"   ✅ Status: {r.status_code}")
    print(f"   Phase: {r.json().get('phase')}")
except Exception as e:
    print(f"   ❌ Error: {e}")
    exit(1)

# Test 2: Generate Identity
print("\n2. Generate Identity...")
try:
    r = requests.get(f"{API_BASE}/identity/generate", timeout=5)
    data = r.json()
    private_key = data['private_key']
    creator_id = data['creator_id']
    print(f"   ✅ Creator ID: {creator_id[:8]}...")
    print(f"   Public Key: {data['public_key'][:16]}...")
except Exception as e:
    print(f"   ❌ Error: {e}")
    exit(1)

# Test 3: Upload Video
print("\n3. Upload Video...")
try:
    with open(VIDEO_PATH, 'rb') as f:
        files = {'file': ('Screen Recording 2025-04-04 104451.mp4', f, 'video/mp4')}
        r = requests.post(f"{API_BASE}/intake/upload", files=files, timeout=30)
    data = r.json()
    task_id = data['task_id']
    print(f"   ✅ Task ID: {task_id[:8]}...")
except Exception as e:
    print(f"   ❌ Error: {e}")
    exit(1)

# Test 4: Wait for processing
print("\n4. Processing Video...")
max_wait = 60
start = time.time()
while time.time() - start < max_wait:
    r = requests.get(f"{API_BASE}/intake/status/{task_id}", timeout=5)
    status = r.json()
    if status['status'] == 'complete':
        print(f"   ✅ Processing complete!")
        print(f"   SHA-256: {status['result']['sha256'][:16]}...")
        print(f"   Frames: {status['result']['frame_count']}")
        break
    elif status['status'] == 'error':
        print(f"   ❌ Processing error: {status.get('error')}")
        exit(1)
    time.sleep(1)
else:
    print(f"   ⚠️ Timeout")
    exit(1)

# Test 5: Sign
print("\n5. Signing Manifest...")
try:
    payload = {
        "task_id": task_id,
        "private_key": private_key,
        "creator_id": creator_id,
        "creator_name": "Test Creator"
    }
    r = requests.post(f"{API_BASE}/intake/sign", json=payload, timeout=10)
    if r.status_code != 200:
        print(f"   ❌ Signing failed: {r.status_code}")
        print(f"   Response: {r.text}")
        exit(1)
    data = r.json()
    credential_id = data['credential_id']
    print(f"   ✅ Credential ID: {credential_id}")
    print(f"   Signature: {data['signature'][:16]}...")
except Exception as e:
    print(f"   ❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

# Test 6: Verify
print("\n6. Verification Test...")
try:
    with open(VIDEO_PATH, 'rb') as f:
        files = {'file': ('Screen Recording 2025-04-04 104451.mp4', f, 'video/mp4')}
        r = requests.post(f"{API_BASE}/verify", files=files, timeout=30)
    data = r.json()
    print(f"   ✅ Status: {data['status']}")
    print(f"   Match Type: {data['match_type']}")
    print(f"   Credential: {data.get('credential_id', 'N/A')}")
    print(f"   Message: {data.get('message', 'N/A')}")
except Exception as e:
    print(f"   ❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*50)
print("🎉 PHASE 1 TESTING COMPLETE!")
print("="*50)
print(f"\nFinal Credential ID: {credential_id}")
