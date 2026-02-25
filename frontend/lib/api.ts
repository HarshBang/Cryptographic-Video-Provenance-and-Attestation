const API_BASE_URL = "http://localhost:8000/api";

export async function uploadVideo(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE_URL}/intake/upload`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        throw new Error(`Upload failed: ${res.statusText}`);
    }

    return res.json(); // Returns { task_id, message }
}

export async function pollStatus(taskId: string) {
    const res = await fetch(`${API_BASE_URL}/intake/status/${taskId}`);
    if (!res.ok) {
        throw new Error(`Status check failed: ${res.statusText}`);
    }
    return res.json(); // Returns Task dict
}

export async function signManifest(taskId: string, privateKey: string, creatorId?: string) {
    const res = await fetch(`${API_BASE_URL}/intake/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            task_id: taskId,
            private_key: privateKey,
            creator_id: creatorId || "did:key:unknown"
        }),
    });

    if (!res.ok) {
        throw new Error(`Signing failed: ${res.statusText}`);
    }

    return res.json(); // Returns { manifest, signature, status }
}

export async function generateIdentity() {
    const res = await fetch(`${API_BASE_URL}/identity/generate`);
    if (!res.ok) throw new Error("Failed to generate identity");
    return res.json();
}
