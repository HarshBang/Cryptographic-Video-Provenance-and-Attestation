"use client"

import { Verified, MailCheck, TrendingUp, CheckCircle, Copy, Download, Play, FileText, FileDown, Trash2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

interface Video {
    id: string
    filename: string
    file_size: number
    sha256: string
    credential_id: string
    manifest: any
    manifest_hash: string
    signature: string
    public_key: string
    key_fingerprint: string
    sealed_at: string
    created_at: string
    creator_name: string
    creator_email: string
}

export default function DashboardPage() {
    const [videos, setVideos] = useState<Video[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    useEffect(() => {
        fetchVideos()
    }, [])

    const fetchVideos = async () => {
        try {
            const { listVideos } = await import("@/lib/api")
            const data = await listVideos()
            setVideos(data.videos || [])
        } catch (e: any) {
            setError(e.message || "Failed to load videos")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (credentialId: string) => {
        if (!confirm("Are you sure you want to unseal and delete this video forever? This cannot be undone.")) return;
        
        try {
            setDeletingId(credentialId);
            const { deleteVideo } = await import("@/lib/api");
            await deleteVideo(credentialId);
            // Refresh video list
            await fetchVideos();
        } catch (e: any) {
            alert(e.message || "Failed to delete video");
        } finally {
            setDeletingId(null);
        }
    }

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return "0 B"
        const k = 1024
        const sizes = ["B", "KB", "MB", "GB"]
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
    }

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A"
        return new Date(dateStr).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
        })
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
    }

    const downloadManifest = (video: Video) => {
        const manifestData = {
            ...video.manifest,
            signature: video.signature,
            credential_id: video.credential_id,
            manifest_hash: video.manifest_hash,
            creator_email: video.creator_email || "N/A"
        }
        const blob = new Blob([JSON.stringify(manifestData, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `manifest-${video.credential_id}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const downloadPDF = async (video: Video) => {
        const { jsPDF } = await import("jspdf")
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

        // ── Constants ────────────────────────────────────────────────────────
        const W = 210
        const M = 16
        const CW = W - M * 2
        // Palette — clean, print-safe, high contrast
        const NAVY   = [12,  35,  75]  as [number,number,number]  // header bg
        const BLUE   = [28,  78, 158]  as [number,number,number]  // accents
        const LTBLUE = [232, 238, 250] as [number,number,number]  // card bg
        const BLACK  = [18,  18,  28]  as [number,number,number]  // body text
        const DKGRAY = [55,  65,  80]  as [number,number,number]  // labels (was GRAY — now dark enough)
        const MIDGRAY= [100, 110, 125] as [number,number,number]  // secondary text
        const FGRAY  = [160, 168, 180] as [number,number,number]  // footer text (visible on white)
        const WHITE  = [255, 255, 255] as [number,number,number]
        const GREEN  = [22, 115,  65]  as [number,number,number]  // sealed badge bg
        const LGREEN = [218, 245, 230] as [number,number,number]  // light green tint

        // ── Data ─────────────────────────────────────────────────────────────
        const m    = video.manifest || {}
        const iden = m.identity || {}
        const ast  = m.asset || {}
        const ps   = m.perceptual_signature || {}
        const hashSeq: string[] = ps.hash_sequence || []
        const frameCount: number = ps.frame_count ?? hashSeq.length
        const creatorName = iden.creator_name || video.creator_name || "Author"
        const creatorEmail = video.creator_email || iden.creator_email || "N/A"
        const sealedAt = video.sealed_at
            ? new Date(video.sealed_at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })
            : "N/A"
        const genDate = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })

        // ── Helpers ──────────────────────────────────────────────────────────
        const sf = (style: "normal"|"bold", size: number, color: [number,number,number]) => {
            doc.setFont("helvetica", style)
            doc.setFontSize(size)
            doc.setTextColor(...color)
        }

        const drawFooter = (pageLabel: string) => {
            doc.setDrawColor(...FGRAY)
            doc.setLineWidth(0.3)
            doc.line(M, 280, W - M, 280)
            // left: credential id for quick reference
            sf("normal", 8, FGRAY)
            doc.text(`CVPA Certificate  |  ${pageLabel}`, M, 286)
            sf("normal", 8, FGRAY)
            doc.text(`Generated: ${genDate}`, W - M, 286, { align: "right" })
        }
        const sectionTitle = (title: string, y: number): number => {
            doc.setFillColor(...BLUE)
            doc.rect(M, y - 3, 3, 7, "F")
            sf("bold", 10, NAVY)
            doc.text(title.toUpperCase(), M + 6, y + 1)
            doc.setDrawColor(...LTBLUE)
            doc.setLineWidth(0.4)
            doc.line(M + 6, y + 2.5, W - M, y + 2.5)
            return y + 10
        }

        // Page 1 detail row — label left, value right, no separator line
        const detailRow = (label: string, value: string, y: number, labelW = 46): number => {
            sf("bold", 10, DKGRAY)
            doc.text(label, M, y)
            sf("normal", 10, BLACK)
            const lines = doc.splitTextToSize(value, CW - labelW)
            doc.text(lines, M + labelW, y)
            return y + 5.5 * lines.length + 1.5
        }

        // Page 2 tech row — bold label, monospace value, no separator line
        const techRow = (label: string, value: string, y: number, labelW = 46): number => {
            sf("bold", 9, DKGRAY)
            doc.text(label, M, y)
            doc.setFont("courier", "normal")
            doc.setFontSize(8.5)
            doc.setTextColor(...BLACK)
            const lines = doc.splitTextToSize(value || "N/A", CW - labelW)
            doc.text(lines, M + labelW, y)
            return y + 4.5 * lines.length + 2
        }

        // Page overflow check — adds new page if y exceeds safe area
        const PAGE_BOTTOM = 268
        const checkPageBreak = (y: number, neededHeight: number = 16): number => {
            if (y + neededHeight > PAGE_BOTTOM) {
                doc.addPage()
                doc.setFillColor(...NAVY)
                doc.rect(0, 0, W, 34, "F")
                sf("bold", 14, WHITE)
                doc.text("CVPA Technical Evidence Report (cont.)", M, 20)
                drawFooter("Technical Evidence (cont.)")
                return 48
            }
            return y
        }

        // ════════════════════════════════════════════════════════════════════
        // PAGE 1 — Human-readable certificate
        // ════════════════════════════════════════════════════════════════════

        // Header band — taller to breathe
        doc.setFillColor(...NAVY)
        doc.rect(0, 0, W, 34, "F")

        // Title — left aligned, vertically centred in band
        sf("bold", 18, WHITE)
        doc.text("CVPA Content Authenticity Certificate", M, 16)

        // Thin rule under title
        doc.setDrawColor(60, 90, 140)
        doc.setLineWidth(0.3)
        doc.line(M, 19, W - M, 19)

        // Issued date line — replaces the full-form subtitle
        sf("normal", 9, [160, 180, 210] as [number,number,number])
        doc.text(`Issued: ${sealedAt}`, M, 27)

        // SEALED badge — right side, properly vertically centred in band
        // Pill: 38 wide × 14 tall, centred at y=17
        const badgeW = 38
        const badgeH = 14
        const badgeX = W - M - badgeW
        const badgeY = 10
        doc.setFillColor(...GREEN)
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3, 3, "F")
        // White border for definition
        doc.setDrawColor(...WHITE)
        doc.setLineWidth(0.4)
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3, 3, "S")
        sf("bold", 10, WHITE)
        doc.text("SEALED", badgeX + badgeW / 2, badgeY + badgeH / 2 + 1.5, { align: "center" })

        // Page label — below header band
        sf("normal", 8, MIDGRAY)
        doc.text("Page 1 of 2  —  Overview for Content Owners, Journalists & Legal Teams", M, 40)

        // ── Intro box ────────────────────────────────────────────────────────
        let y = 47
        const introText = "This certificate proves that the video listed below was created & signed by its author using the CVPA system."
        const introLines = doc.splitTextToSize(introText, CW - 10)
        const introLineH = 5.5
        const introPadV = 7
        const introBoxH = introLines.length * introLineH + introPadV * 2
        doc.setFillColor(...LTBLUE)
        doc.roundedRect(M, y, CW, introBoxH, 2, 2, "F")
        sf("normal", 10, NAVY)
        doc.text(introLines, M + 5, y + introPadV + 3.5)
        y += introBoxH + 6

        // ── Video Details ────────────────────────────────────────────────────
        y = sectionTitle("Video Details", y)
        y = detailRow("File Name",     video.filename || "N/A",         y)
        y = detailRow("File Size",     formatFileSize(video.file_size), y)
        y = detailRow("Date Sealed",   sealedAt,                        y)
        y = detailRow("Author",        creatorName,                     y)
        y = detailRow("Author Email",  creatorEmail,                    y)
        y = detailRow("Credential ID", video.credential_id || "N/A",   y)
        y += 6

        // ── How CVPA Protects This Video ─────────────────────────────────────
        y = sectionTitle("How CVPA Protects This Video", y)

        const cardW = (CW - 8) / 3
        const cardH = 56
        const cards = [
            {
                num: "01",
                title: "SHA-256 Fingerprint",
                body: "A unique mathematical fingerprint of every byte in the video. If even one pixel changes, this fingerprint changes — making tampering instantly detectable.",
            },
            {
                num: "02",
                title: "Perceptual Hash (pHash)",
                body: "A visual fingerprint sampled from frames across the video. Catches the same content even after re-encoding, compression, or platform re-upload.",
            },
            {
                num: "03",
                title: "Ed25519 Signature",
                body: "The author's private key — which never leaves their device — signs the entire evidence package. Only the matching public key can confirm authenticity.",
            },
        ]
        cards.forEach((c, i) => {
            const cx = M + i * (cardW + 4)
            // card bg
            doc.setFillColor(...LTBLUE)
            doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F")
            // left accent stripe
            doc.setFillColor(...BLUE)
            doc.roundedRect(cx, y, 3, cardH, 1, 1, "F")
            // number
            sf("bold", 20, BLUE)
            doc.text(c.num, cx + 8, y + 14)
            // title
            sf("bold", 9.5, NAVY)
            const titleLines = doc.splitTextToSize(c.title, cardW - 12)
            doc.text(titleLines, cx + 8, y + 22)
            // body
            sf("normal", 8.5, DKGRAY)
            const bodyLines = doc.splitTextToSize(c.body, cardW - 12)
            doc.text(bodyLines, cx + 8, y + 22 + titleLines.length * 5.5 + 3)
        })
        y += cardH + 8

        // ── How to Verify ────────────────────────────────────────────────────
        y = sectionTitle("How to Verify This Video", y)
        const verifySteps: [string, string][] = [
            ["1", "Visit the CVPA Verification page in your browser."],
            ["2", "Upload the video file you received."],
            ["3", "CVPA computes the SHA-256 and pHash of the uploaded file and compares them against the registry."],
            ["4", "A green Authenticated result confirms the video is original and the signature is valid."],
        ]
        verifySteps.forEach(([num, text]) => {
            // circle bullet
            doc.setFillColor(...BLUE)
            doc.circle(M + 4, y - 1, 4, "F")
            sf("bold", 9, WHITE)
            doc.text(num, M + 4, y + 0.5, { align: "center" })
            sf("normal", 10, BLACK)
            const lines = doc.splitTextToSize(text, CW - 14)
            doc.text(lines, M + 12, y)
            y += 6.5 * lines.length + 3
        })

        drawFooter("Page 1 of 2")

        // ════════════════════════════════════════════════════════════════════
        // PAGE 2 — Technical Evidence Report
        // ════════════════════════════════════════════════════════════════════
        doc.addPage()

        doc.setFillColor(...NAVY)
        doc.rect(0, 0, W, 34, "F")
        sf("bold", 18, WHITE)
        doc.text("CVPA Technical Evidence Report", M, 16)
        doc.setDrawColor(60, 90, 140)
        doc.setLineWidth(0.3)
        doc.line(M, 19, W - M, 19)
        sf("normal", 9, [160, 180, 210] as [number,number,number])
        doc.text("Cryptographic hashes, digital signature & perceptual fingerprint data", M, 27)

        sf("normal", 8, MIDGRAY)
        doc.text("Page 2 of 2  —  For Technical Verification, DMCA Filings & Legal Audit", M, 40)

        y = 48

        // ── Hard Binding ─────────────────────────────────────────────────────
        y = sectionTitle("Hard Binding — SHA-256 File Fingerprint", y)
        y = techRow("SHA-256 Hash",   ast.sha256 || video.sha256 || "N/A", y)
        y = techRow("Manifest Hash",  video.manifest_hash || "N/A",        y)
        y += 5

        // ── Digital Signature ────────────────────────────────────────────────
        y = checkPageBreak(y, 50)
        y = sectionTitle("Digital Signature — Ed25519", y)
        y = techRow("Algorithm",       "Ed25519",                                           y)
        y = techRow("Signature",       video.signature || "N/A",                            y)
        y = techRow("Public Key",      video.public_key || iden.creator_pub_key || "N/A",   y)
        y = techRow("Key Fingerprint", video.key_fingerprint || iden.key_fingerprint || "N/A", y)
        y += 5

        // ── Soft Binding — pHash Sequence ────────────────────────────────────
        y = checkPageBreak(y, 40)
        y = sectionTitle("Soft Binding — Perceptual Hash Sequence (dHash)", y)
        y = techRow("Algorithm",        "dHash — difference hash of sampled frames",  y)
        y = techRow("Sampling Rate",    ps.sampling_rate || "1 frame per 2 seconds",  y)
        y = techRow("Frames Processed", String(frameCount),                           y)

        if (hashSeq.length > 0) {
            y += 2
            y = checkPageBreak(y, 20)
            sf("bold", 9, DKGRAY)
            doc.text("Hash Sequence", M, y)
            y += 5

            // Render hash sequence row by row, adding new pages as needed
            const rowH = 5.5
            const colW = CW / 2 - 4
            const rowsNeeded = Math.ceil(hashSeq.length / 2)

            // Collect rows into chunks that fit on a page
            let rowStart = 0
            while (rowStart < rowsNeeded) {
                const availableH = PAGE_BOTTOM - y - 6
                const rowsFit = Math.max(1, Math.floor(availableH / rowH))
                const rowsThisPage = Math.min(rowsFit, rowsNeeded - rowStart)
                const boxH = rowsThisPage * rowH + 6

                doc.setFillColor(240, 244, 252)
                doc.roundedRect(M, y, CW, boxH, 2, 2, "F")
                doc.setDrawColor(...LTBLUE)
                doc.setLineWidth(0.3)
                doc.roundedRect(M, y, CW, boxH, 2, 2, "S")

                doc.setFont("courier", "normal")
                doc.setFontSize(8)
                doc.setTextColor(...BLACK)

                for (let r = 0; r < rowsThisPage; r++) {
                    const globalRow = rowStart + r
                    for (let col = 0; col < 2; col++) {
                        const idx = globalRow * 2 + col
                        if (idx >= hashSeq.length) break
                        const hx = M + 4 + col * (colW + 8)
                        const hy = y + 5 + r * rowH
                        doc.setTextColor(...BLUE)
                        doc.setFontSize(7.5)
                        doc.text(`[${String(idx + 1).padStart(2, "0")}]`, hx, hy)
                        doc.setTextColor(...BLACK)
                        doc.setFontSize(8)
                        doc.text(hashSeq[idx], hx + 10, hy)
                    }
                }

                y += boxH + 4
                rowStart += rowsThisPage

                if (rowStart < rowsNeeded) {
                    drawFooter("Technical Evidence (cont.)")
                    doc.addPage()
                    doc.setFillColor(...NAVY)
                    doc.rect(0, 0, W, 34, "F")
                    sf("bold", 14, WHITE)
                    doc.text("CVPA Technical Evidence Report (cont.)", M, 20)
                    y = 48
                    sf("bold", 9, DKGRAY)
                    doc.text("Hash Sequence (cont.)", M, y)
                    y += 5
                }
            }
            y += 2
        }

        // ── Manifest Metadata ────────────────────────────────────────────────
        y = checkPageBreak(y, 60)
        y = sectionTitle("Manifest Metadata", y)
        y = techRow("Manifest Version", m.manifest_version || m.version || "1.1",                    y)
        y = techRow("Timestamp (UTC)",  m.timestamp || video.sealed_at || "N/A",                     y)
        y = techRow("Credential ID",    video.credential_id || "N/A",                                y)
        y = techRow("Creator",          creatorName,                                                  y)
        y = techRow("Creator Email",    creatorEmail,                                                 y)
        y = techRow("File Name",        video.filename || "N/A",                                     y)
        y = techRow("File Size",        `${video.file_size} bytes  (${formatFileSize(video.file_size)})`, y)
        y = techRow("Producer",         m.producer || "CVPA Provenance System",                      y)

        drawFooter("Page 2 of 2")

        doc.save(`cvpa-certificate-${video.credential_id?.slice(0, 12) || "unknown"}.pdf`)
    }

    return (
        <>
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-col gap-1">
                    <h2 className="text-white text-3xl md:text-4xl font-bold tracking-tight">Dashboard</h2>
                    <p className="text-vca-text-secondary text-base font-normal">Manage your signed videos and verification requests.</p>
                </div>
                <Link href="/dashboard/intake">
                    <button className="flex items-center justify-center gap-2 rounded-lg h-12 px-6 bg-primary hover:bg-primary/90 text-white text-sm font-bold tracking-wide transition-all shadow-lg shadow-primary/20 hover:translate-y-[-2px]">
                        <Play className="fill-current w-4 h-4" />
                        <span>Sign New Video</span>
                    </button>
                </Link>
            </header>

            {/* Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* Stat Card 1 */}
                <div className="relative overflow-hidden rounded-xl p-6 bg-vca-surface-dark border border-vca-border-dark flex flex-col justify-between gap-4 group hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Verified className="w-16 h-16 text-white" />
                    </div>
                    <div>
                        <p className="text-vca-text-secondary text-sm font-medium uppercase tracking-wider">Total Signed Videos</p>
                        <p className="text-white text-4xl font-bold mt-1">{videos.length}</p>
                    </div>
                    <div className="flex items-center gap-2 text-vca-success">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Digitally Sealed</span>
                    </div>
                </div>

                {/* Stat Card 2 */}
                <div className="relative overflow-hidden rounded-xl p-6 bg-vca-surface-dark border border-vca-border-dark flex flex-col justify-between gap-4 group hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <MailCheck className="w-16 h-16 text-white" />
                    </div>
                    <div>
                        <p className="text-vca-text-secondary text-sm font-medium uppercase tracking-wider">Verification Status</p>
                        <p className="text-white text-4xl font-bold mt-1">Active</p>
                    </div>
                    <div className="flex items-center gap-2 text-primary">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm font-medium">Ready to Verify</span>
                    </div>
                </div>
            </div>

            {/* Recent Activity Table */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-white text-xl font-bold">Signed Videos</h3>
                    <button 
                        onClick={fetchVideos}
                        className="text-primary hover:text-white text-sm font-medium transition-colors"
                    >
                        Refresh
                    </button>
                </div>
                
                {loading && (
                    <div className="p-8 text-center text-vca-text-secondary">
                        Loading videos...
                    </div>
                )}
                
                {error && (
                    <div className="p-8 text-center text-red-400">
                        Error: {error}
                    </div>
                )}
                
                {!loading && !error && videos.length === 0 && (
                    <div className="p-8 text-center text-vca-text-secondary">
                        No signed videos yet. <Link href="/dashboard/intake" className="text-primary hover:underline">Sign your first video</Link>
                    </div>
                )}
                
                {!loading && !error && videos.length > 0 && (
                    <div className="rounded-xl border border-vca-border-dark bg-vca-surface-dark overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[800px]">
                                <thead className="bg-[#192233] border-b border-vca-border-dark">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-vca-text-secondary text-xs font-semibold uppercase tracking-wider">Video Title</th>
                                        <th className="px-6 py-4 text-left text-vca-text-secondary text-xs font-semibold uppercase tracking-wider">Date Signed</th>
                                        <th className="px-6 py-4 text-left text-vca-text-secondary text-xs font-semibold uppercase tracking-wider">Credential ID</th>
                                        <th className="px-6 py-4 text-left text-vca-text-secondary text-xs font-semibold uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-right text-vca-text-secondary text-xs font-semibold uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-vca-border-dark">
                                    {videos.map((video) => (
                                        <tr key={video.id} className={`hover:bg-white/5 transition-colors group ${deletingId === video.credential_id ? 'opacity-50 pointer-events-none' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-shrink-0 w-16 h-10 rounded overflow-hidden bg-slate-800 border border-slate-700 relative flex items-center justify-center">
                                                        <video 
                                                            src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/uploads/${encodeURIComponent(video.filename)}#t=1.0`} 
                                                            className="w-full h-full object-cover"
                                                            preload="metadata"
                                                            muted
                                                            playsInline
                                                            crossOrigin="anonymous"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col truncate">
                                                        <span className="text-white font-medium text-sm truncate max-w-[200px]" title={video.filename}>{video.filename}</span>
                                                        <span className="text-xs text-slate-500">{formatFileSize(video.file_size)}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-slate-300 text-sm">{formatDate(video.sealed_at)}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <code className="text-xs text-primary bg-primary/10 px-2 py-1 rounded font-mono">
                                                        {video.credential_id.slice(0, 20)}...
                                                    </code>
                                                    <button 
                                                        onClick={() => copyToClipboard(video.credential_id)}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-white"
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-vca-success/10 px-2.5 py-1 text-xs font-medium text-vca-success border border-vca-success/20">
                                                    <Verified className="w-3.5 h-3.5" />
                                                    Sealed
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button 
                                                        onClick={() => downloadManifest(video)}
                                                        className="text-slate-400 hover:text-primary transition-colors p-2 rounded hover:bg-primary/10"
                                                        title="Download Manifest JSON"
                                                    >
                                                        <FileText className="w-5 h-5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => downloadPDF(video)}
                                                        className="text-slate-400 hover:text-white transition-colors p-2 rounded hover:bg-white/10"
                                                        title="Download Certificate PDF"
                                                    >
                                                        <FileDown className="w-5 h-5" />
                                                    </button>
                                                    <div className="w-px h-4 bg-slate-700 mx-1"></div>
                                                    <button 
                                                        onClick={() => handleDelete(video.credential_id)}
                                                        className="text-slate-400 hover:text-red-400 transition-colors p-2 rounded hover:bg-red-400/10"
                                                        title="Unseal & Delete Video"
                                                        disabled={deletingId === video.credential_id}
                                                    >
                                                        {deletingId === video.credential_id ? (
                                                            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-5 h-5" />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
