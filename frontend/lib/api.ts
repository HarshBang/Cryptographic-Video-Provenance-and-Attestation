import { API_BASE_URL } from "./config";

// Phase 2 API - Client-Side Signing Architecture

export async function uploadVideo(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const url = `${API_BASE_URL}/intake/upload`;
    console.log("Uploading to:", url);

    try {
        const res = await fetch(url, {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Upload failed: ${res.status} ${res.statusText} - ${errorText}`);
        }

        return res.json(); // Returns { task_id, message }
    } catch (error: any) {
        console.error("Fetch error details:", error);
        if (error.message === 'Failed to fetch') {
            throw new Error(`Cannot connect to backend at ${url}. Please ensure the backend server is running on port 8000 and check browser console for CORS errors.`);
        }
        throw error;
    }
}

export async function pollStatus(taskId: string) {
    const res = await fetch(`${API_BASE_URL}/intake/status/${taskId}`);
    if (!res.ok) {
        throw new Error(`Status check failed: ${res.statusText}`);
    }
    return res.json(); // Returns Task dict with phase and result
}

/**
 * Phase 2 - Finalize signature with client-side generated signature
 * This replaces the old signManifest which sent private key to server
 */
export async function finalizeSignature(
    taskId: string, 
    signature: string, 
    publicKey: string, 
    creatorName?: string
) {
    const res = await fetch(`${API_BASE_URL}/intake/finalize-signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            task_id: taskId,
            signature: signature,
            public_key: publicKey,
            creator_name: creatorName
        }),
    });

    if (!res.ok) {
        const error = await res.text();
        throw new Error(`Signature finalization failed: ${error}`);
    }

    return res.json(); // Returns { credential_id, manifest, manifest_hash, signature_valid, status }
}

/**
 * Phase 2 - Register a client-generated public key
 * Use this after generating keys with tweetnacl in the browser
 */
export async function registerIdentity(publicKey: string, displayName?: string) {
    const res = await fetch(`${API_BASE_URL}/identity/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            public_key: publicKey,
            display_name: displayName
        }),
    });
    
    if (!res.ok) throw new Error("Failed to register identity");
    return res.json(); // Returns { creator_id, key_fingerprint, status }
}

/**
 * @deprecated Phase 1 - Server-side key generation
 * Use client-side generation with tweetnacl instead
 */
export async function generateIdentity() {
    const res = await fetch(`${API_BASE_URL}/identity/generate`);
    if (!res.ok) throw new Error("Failed to generate identity");
    return res.json(); // Returns { public_key, creator_id, key_fingerprint }
}

/**
 * Phase 2 - Verify a video file
 */
export async function verifyVideo(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE_URL}/verify`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        throw new Error(`Verification failed: ${res.statusText}`);
    }

    return res.json(); // Returns VerifyResponse with signature_valid, manifest_hash, etc.
}

/**
 * Get video details by credential ID
 */
export async function getVideoByCredential(credentialId: string) {
    const res = await fetch(`${API_BASE_URL}/videos/${credentialId}`);
    if (!res.ok) {
        throw new Error(`Failed to get video: ${res.statusText}`);
    }
    return res.json();
}

/**
 * List all signed videos for dashboard
 */
export async function listVideos(limit: number = 50, offset: number = 0) {
    const res = await fetch(`${API_BASE_URL}/videos?limit=${limit}&offset=${offset}`);
    if (!res.ok) {
        throw new Error(`Failed to list videos: ${res.statusText}`);
    }
    return res.json(); // Returns { videos, total, limit, offset }
}
