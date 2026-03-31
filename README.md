# CVPA: Cryptographic Video Provenance & Attestation
![Frontend](https://img.shields.io/badge/Frontend-UI%20Layer-blue?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

![Backend](https://img.shields.io/badge/Backend-Server%20%26%20API-green?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-27338e?style=for-the-badge&logo=opencv&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

![Cryptography](https://img.shields.io/badge/Cryptography-NaCl-blue?style=for-the-badge)
![Hashing](https://img.shields.io/badge/Hashing-SHA256-purple?style=for-the-badge)
![Video Forensics](https://img.shields.io/badge/Video%20Forensics-pHash%20Analysis-red?style=for-the-badge)
![Digital Signature](https://img.shields.io/badge/Digital%20Signature-Ed25519-green?style=for-the-badge)

## What It Does

CVPA gives video creators a way to cryptographically seal their content at the moment of creation. Anyone who later receives that video can verify its authenticity against the registry, even if the video was re-encoded, compressed, or re-uploaded to a platform.

The system provides:
- Cryptographic proof of authorship
- Integrity verification (exact and perceptual)
- Visual similarity detection across re-encoded copies

The system does **not** provide DRM, content access restriction, or piracy prevention. It is a forensic evidence tool.



## How It Works

<img width="1120" height="523" alt="Image" src="https://github.com/user-attachments/assets/f17edeac-89a1-473b-b9c0-cc507d63f888" />

Every sealed video goes through three binding layers:

**1. Hard Binding - SHA-256:**
A byte-exact fingerprint of the original file. If a single bit changes, the hash changes. Used for exact-match verification.

**2. Soft Binding - dHash Perceptual Sequence:**
 OpenCV samples one frame every 2 seconds across the video. Each frame is converted to a difference hash (dHash). This sequence is resilient to re-encoding, compression, and platform re-upload. The same visual content produces a similar hash sequence even after format conversion.

**3. Ed25519 Digital Signature:**
 The creator's private key generated entirely in the browser using `tweetnacl` and **never sent to the server** — signs a canonical JSON manifest containing both hash layers. The backend verifies the signature using only the public key.



## Architecture

```
Frontend (Next.js)          Backend (FastAPI)          Web Extension (Chrome)
─────────────────           ─────────────────          ──────────────────────
Browser keypair gen    →    /api/intake/upload    ←    Context menu actions
Client-side signing    →    /api/intake/finalize  ←    Video verification
Verification UI        →    /api/verify           ←    Direct/social URLs
Dashboard              →    /api/videos
Identity management    →    /api/identity/register
```

### Components

**Frontend:** Next.js 16 app with client-side Ed25519 signing  
**Backend:** FastAPI with OpenCV video processing  
**Web Extension:** Chrome extension for browser-based verification  
**Database:** SQLite (production-ready for current scale)

### Backend: `backend/`

| File | Responsibility |
|---|---|
| `main.py` | FastAPI app, all route definitions, background task dispatch |
| `core/hashing.py` | SHA-256 calculation, time-based frame sampling, dHash sequence generation |
| `core/signing.py` | Ed25519 key operations, canonical JSON serialization, manifest generation, signature verification |
| `core/database.py` | SQLite schema, all queries, job tracking, duplicate detection |
| `vca.db` | SQLite database (auto-created on startup) |
| `uploads/` | Temporary file storage during processing (files deleted after sealing) |

### Frontend: `frontend/`

| Path | Responsibility |
|---|---|
| `app/page.tsx` | Landing page |
| `app/dashboard/page.tsx` | Signed video registry, manifest/PDF download |
| `app/dashboard/intake/page.tsx` | Key management + intake wizard entry |
| `app/dashboard/identity/page.tsx` | Ed25519 keypair generation and import |
| `app/verify/page.tsx` | Public verification portal |
| `components/intake/IntakeWizard.tsx` | 3-step upload → process → seal flow |
| `components/intake/ManifestPreview.tsx` | Live manifest preview during sealing |
| `components/intake/TerminalLog.tsx` | Real-time processing log |
| `components/Sidebar.tsx` | Dashboard navigation |
| `lib/api.ts` | All backend fetch calls |
| `lib/config.ts` | Centralised API URL and system config |

### Web Extension: `web-extension/`

Chrome extension for browser-based video verification:

- **Context Menu Actions:** Right-click verification for direct video URLs and social media pages
- **Popup Interface:** Quick access to verification and dashboard
- **Social Media Support:** Instagram, LinkedIn via yt-dlp
- **CORS Configuration:** Backend configured with `chrome-extension://*` origin

**Installation:** Load unpacked extension from `Cryptographic-Video-Provenance-and-Attestation/web-extension/` in Chrome developer mode.



## Database Schema

**`creators:`** Identity registry
- `id`, `public_key`, `key_fingerprint`, `display_name`, `created_at`

**`videos:`** Sealed content registry
- `id`, `credential_id`, `creator_id` (FK), `filename`, `file_size`, `mime_type`
- `sha256` - hard binding
- `phash`, `phash_sequence` - soft binding (full dHash sequence stored as JSON)
- `manifest` - full canonical manifest JSON
- `manifest_hash` - SHA-256 of canonical manifest (for tamper detection)
- `signature`, `public_key`, `key_fingerprint`
- `status`, `sealed_at`, `created_at`

**`processing_jobs:`** Async task tracking
- `task_id`, `job_type`, `status`, `progress`, `phase`, `result`, `error_message`
- Phases: `pending → hashing → frame_extraction → phash → complete`



## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/intake/upload` | Upload video, start background processing |
| `GET` | `/api/intake/status/{task_id}` | Poll processing progress |
| `POST` | `/api/intake/finalize-signature` | Submit client-side signature, seal the record |
| `POST` | `/api/verify` | Verify a video (exact SHA or pHash similarity) |
| `POST` | `/api/identity/register` | Register a client-generated public key |
| `GET` | `/api/videos` | List all sealed videos |
| `GET` | `/api/videos/{credential_id}` | Get video details by credential ID |
| `GET` | `/api/health` | System health check |

### Intake Flow (detailed)

```
1. POST /api/intake/upload
   → Returns task_id

2. GET /api/intake/status/{task_id}   (poll every 1s)
   → Returns { status, phase, progress, result }
   → result contains canonical_manifest + manifest_hash when complete

3. Browser signs canonical_manifest bytes with Ed25519 private key (tweetnacl)

4. POST /api/intake/finalize-signature
   → { task_id, signature, public_key }
   → Backend verifies signature, stores sealed record
   → Returns { credential_id, manifest, manifest_hash, signature_valid }
```


## Security Model

CVPA operates on a **Zero-Trust, client-side signing** model:

- Private keys are generated in the browser (`nacl.sign.keyPair()`) and never transmitted
- The backend only ever receives and stores the **public key**
- Signatures are verified server-side using the public key before any record is committed
- The canonical manifest is deterministically serialized (UTF-8, sorted keys, no whitespace) ensuring cross-platform reproducibility
- On every retrieval, the stored signature is re-verified against the stored manifest to detect DB-level tampering
- Duplicate SHA-256 uploads are detected and rejected before processing


## Verification Engine

When a video is submitted to `/api/verify`:

1. **Exact match:** SHA-256 of the uploaded file is looked up in the registry. If found, the stored Ed25519 signature is re-verified and the result is returned as `verified`.

2. **Perceptual match:** If no exact match, the engine computes the dHash sequence of the uploaded video and calculates weighted Hamming distance against all stored sequences. A similarity score above 85% returns `verified` (re-encoded copy); between thresholds returns `warning`.

3. **No match:** Returns `unknown`. The video has no record in the CVPA registry.



## Deployment

### Production (AWS EC2)

The system is deployed on AWS EC2 (Ubuntu AMI, t2.micro free tier Instance) with HTTPS:

- **URL:** https://13.235.99.232.nip.io
- **SSL:** Encrypt certificates via Certbot
- **Domain:** nip.io (automatic DNS for any IP)
- **Reverse Proxy:** nginx
- **Services:** systemd (vca-backend, vca-frontend)

**Key Configuration:**
- Backend runs on port 8000 (proxied through nginx)
- Frontend runs on port 3000 (proxied through nginx)
- CORS configured for web extension support
- AWS Cognito callbacks configured for HTTPS domain

For detailed deployment instructions, see [Docs](https://drive.google.com/drive/folders/1TXoBV3ZyYSAJR_a1j7f6Szo_HSaCArh4?usp=sharing).

### Local Development

**Prerequisites:**
- Python 3.10+
- Node.js 20+

**Backend:**
```bash
cd vca-system/backend
python -m venv venv

# Windows:
venv\Scripts\activate

# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd vca-system/frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api" > .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).



## Frontend Dependencies

| Package | Purpose |
|---|---|
| `next` 16 | App framework (App Router) |
| `react` 19 | UI |
| `tweetnacl` | Ed25519 keypair generation and signing (browser) |
| `tweetnacl-util` | Base64/UTF-8 encoding helpers |
| `jspdf` | PDF certificate generation |
| `lucide-react` | Icons |
| `tailwindcss` 4 | Styling |
| `clsx` + `tailwind-merge` | Conditional class utilities |

## Backend Dependencies

| Package | Purpose |
|---|---|
| `fastapi` | API framework |
| `uvicorn` | ASGI server |
| `pynacl` | Ed25519 signature verification |
| `opencv-python-headless` | Video frame extraction |
| `imagehash` | dHash perceptual hashing |
| `pillow` | Image processing for hashing |
| `numpy` | Numerical operations |
| `python-multipart` | Multipart file upload parsing |
| `yt-dlp` | Social media video download (for web extension) |



## Key Design Decisions

**Why Ed25519?**
Fast, compact signatures (64 bytes), strong security, and compatible between `tweetnacl` (browser) and `pynacl` (Python backend) using the same base64 key format.

**Why dHash over pHash?**
dHash is faster to compute per-frame and produces stable sequences for time-series comparison. The sequence approach (one hash per 2-second interval) is more robust than a single-frame hash.

**Why canonical JSON?**
Deterministic serialization (sorted keys, no whitespace, UTF-8) ensures the same manifest bytes are produced regardless of platform, language, or JSON library - critical for cross-environment signature verification.

**Why SQLite?**
Sufficient for the current scope. The schema is designed to migrate to PostgreSQL with minimal changes (no SQLite-specific features used beyond `json_extract`).



## Known Limitations / To-Do

| Area | Status | Notes |
|---|---|---|
| File storage | EC2 local storage | Currently on EC2 EBS volume; S3 for videos, RDA for DB recommended |
| Key recovery | Not implemented | No fallback if private key is lost |
| Video playback | Basic | Dashboard shows metadata; no inline player |
| Scalability | Single-process | Task queue (Redis) needed for concurrent processing |
| pHash indexing | Linear scan | LSH indexing needed at scale |
| Audit log | Not implemented | Planned for future phase |



## Project Status

| Layer | Status |
|---|---|
| SHA-256 hard binding | Complete |
| dHash soft binding (full sequence) | Complete |
| Ed25519 client-side signing | Complete |
| Canonical manifest generation | Complete |
| Signature verification on retrieval | Complete |
| Duplicate detection | Complete |
| Dual verification engine | Complete |
| PDF certificate export | Complete |
| Web extension (Chrome) | Complete |
| EC2 deployment with HTTPS | Complete |
| Cloud storage (S3) | Not started |
| Key recovery mechanism | Not started |

## About Me
I am a passionate student at NMIMS School of Technology Management and Engineering, persuing Computer Science Engineering specializing in Data Science.
CVPA reflects my drive to solve real-world societal challenges, particularly in the public safety and law enforcement space, through technology that can have real impact in the field.

This project combines my interests in Cryptogrpahy, backend development, and cloud infrastructure to address critical gaps in video provenance.


## Contact Information
Feel free to connect for collaborations, feedback, or inquiries:

- **Email:** harshbang10@gmail.com 
- **LinkedIn:** [Harsh-Bang](https://www.linkedin.com/in/harshbang/)


**License:** All rights reserved. The code is intended solely for academic purposes.  
