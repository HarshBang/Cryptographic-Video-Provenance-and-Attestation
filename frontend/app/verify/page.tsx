"use client"

import { useState } from "react"
import { Upload, CheckCircle, AlertTriangle, XCircle, Search, Shield, Fingerprint, FileSignature, FileText, FileDown } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { API_BASE_URL } from "@/lib/config"

export default function VerifyPage() {
    const [status, setStatus] = useState<"idle" | "analyzing" | "result">("idle")
    const [resultType, setResultType] = useState<"verified" | "warning" | "error" | "unknown">("unknown")
    const [report, setReport] = useState<any>(null)

    const handleFileSelect = async () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'video/*'
        input.onchange = async (e) => {
            const files = (e.target as HTMLInputElement).files
            if (files && files.length > 0) {
                setStatus("analyzing")
                const file = files[0]
                try {
                    const formData = new FormData()
                    formData.append("file", file)
                    const res = await fetch(`${API_BASE_URL}/verify`, { method: "POST", body: formData })
                    if (!res.ok) throw new Error("Verification Failed")
                    const data = await res.json()
                    setReport(data)
                    if (data.status === "verified") setResultType("verified")
                    else if (data.status === "warning") setResultType("warning")
                    else setResultType("unknown")
                    setStatus("result")
                } catch (e) {
                    console.error(e)
                    setStatus("result")
                    setResultType("error")
                }
            }
        }
        input.click()
    }

    const downloadManifest = async () => {
        if (!report?.credential_id) return
        try {
            const res = await fetch(`${API_BASE_URL}/videos/${report.credential_id}`)
            if (!res.ok) throw new Error("Failed to fetch video record")
            const video = await res.json()
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
        } catch (err: any) {
            alert("Error downloading manifest: " + err.message)
        }
    }

    const downloadPDF = async () => {
        if (!report?.credential_id) return
        try {
            const res = await fetch(`${API_BASE_URL}/videos/${report.credential_id}`)
            if (!res.ok) throw new Error("Failed to fetch video record")
            const video = await res.json()
            const { jsPDF } = await import("jspdf")
            generateVerifyCertPDF(video, report, jsPDF)
        } catch (err: any) {
            alert("Error generating PDF: " + err.message)
        }
    }

    return (
        <div className="min-h-screen bg-vca-bg-dark flex flex-col">
            {/* Header */}
            <header className="border-b border-vca-border-dark bg-[#111722]">
                <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <Shield className="w-6 h-6 text-primary" />
                        <span className="font-bold text-white text-lg">CVPA Verify</span>
                    </Link>
                    <div className="flex gap-4">
                        <Link href="/dashboard" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Creator Login</Link>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 py-12 flex flex-col items-center">
                <div className="text-center mb-10 space-y-2">
                    <h1 className="text-3xl md:text-4xl font-bold text-white">Verify Video Integrity</h1>
                    <p className="text-vca-text-secondary text-lg">
                        Verify SHA-256, pHash similarity, and Ed25519 signatures.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 w-full items-start">
                    
                    {/* Left Column: Upload Area */}
                    <div className="flex flex-col gap-6 w-full">
                        {status === "idle" && (
                            <div
                                onClick={handleFileSelect}
                                className="w-full h-[400px] border-2 border-dashed border-vca-border-dark rounded-2xl bg-vca-surface-dark flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-white/5 transition-all group"
                            >
                                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <Search className="w-8 h-8 text-slate-400 group-hover:text-primary transition-colors" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Upload Video to Verify</h3>
                                <p className="text-slate-400 text-sm">Supports MP4, MOV, WEBM</p>
                                <div className="mt-8 px-4 py-2 bg-slate-800 rounded text-xs text-slate-500 font-mono">
                                    Max file size: 100MB
                                </div>
                            </div>
                        )}

                        {status === "analyzing" && (
                            <div className="w-full h-[400px] rounded-2xl bg-vca-surface-dark border border-vca-border-dark flex flex-col items-center justify-center space-y-6">
                                <div className="relative w-24 h-24">
                                    <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
                                    <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                                    <Shield className="absolute inset-0 m-auto w-8 h-8 text-primary animate-pulse" />
                                </div>
                                <div className="text-center space-y-1">
                                    <h3 className="text-xl font-bold text-white">Analyzing Content</h3>
                                    <p className="text-slate-400 font-mono text-sm">Comparing perceptual hash signatures...</p>
                                </div>
                            </div>
                        )}

                        {status === "result" && (
                            <div
                                onClick={() => setStatus("idle")}
                                className="w-full h-[400px] border-2 border-dashed border-vca-border-dark rounded-2xl bg-vca-surface-dark flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-white/5 transition-all group opacity-80"
                            >
                                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <Search className="w-8 h-8 text-primary transition-colors" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Check Another Video</h3>
                                <p className="text-slate-400 text-sm">Click here to start over</p>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Results Area */}
                    <div className="flex flex-col gap-6 w-full relative">
                        {status === "idle" && (
                            <div className="h-[400px] w-full rounded-2xl border border-dashed border-vca-border-dark flex flex-col items-center justify-center bg-vca-surface-dark/30">
                                <Shield className="w-12 h-12 text-slate-700 mb-4" />
                                <p className="text-slate-500 font-medium">Upload a video to see verification results</p>
                            </div>
                        )}

                        {status === "analyzing" && (
                            <div className="h-[400px] w-full rounded-2xl border border-vca-border-dark flex flex-col items-center justify-center bg-vca-surface-dark/30">
                                <p className="text-slate-500 animate-pulse font-medium">Waiting for analysis to complete...</p>
                            </div>
                        )}

                        {status === "result" && (
                            <div className="w-full space-y-6">
                                {/* Status Card */}
                                <div className={cn(
                                    "rounded-2xl border p-8 text-center space-y-4 shadow-lg",
                                    resultType === "verified" && "bg-green-500/10 border-green-500/30",
                                    resultType === "warning" && "bg-yellow-500/10 border-yellow-500/30",
                                    resultType === "unknown" && "bg-slate-500/10 border-slate-500/30",
                                    resultType === "error" && "bg-red-500/10 border-red-500/30",
                                )}>
                                    <div className="flex justify-center">
                                        {resultType === "verified" && <CheckCircle className="w-16 h-16 text-green-500" />}
                                        {resultType === "warning" && <AlertTriangle className="w-16 h-16 text-yellow-500" />}
                                        {resultType === "unknown" && <XCircle className="w-16 h-16 text-slate-500" />}
                                        {resultType === "error" && <AlertTriangle className="w-16 h-16 text-red-500" />}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">
                                            {resultType === "verified" && "Video Authenticated"}
                                            {resultType === "warning" && "Potential Modification"}
                                            {resultType === "unknown" && "No Record Found"}
                                            {resultType === "error" && "Analysis Error"}
                                        </h2>
                                        <p className="text-slate-300 mt-2">
                                            {resultType === "verified" && "This video is an exact match to the creator's original signature."}
                                            {resultType === "warning" && "Visual content matches, but the file structure differs (e.g. re-encoding)."}
                                            {resultType === "unknown" && "This video has not been signed by the CVPA system."}
                                            {resultType === "error" && "Could not process the video file."}
                                        </p>
                                    </div>

                                    {/* Credential ID prominently in status card */}
                                    {report?.credential_id && (
                                        <div className="mt-2 inline-flex items-center gap-2 bg-black/30 rounded-lg px-4 py-2">
                                            <span className="text-slate-400 text-xs">Credential ID:</span>
                                            <code className="text-primary text-xs font-mono">{report.credential_id}</code>
                                        </div>
                                    )}
                                </div>

                                {/* Evidence Details */}
                                {(resultType === "verified" || resultType === "warning") && report && (
                                    <div className="bg-vca-surface-dark border border-vca-border-dark rounded-xl overflow-hidden shadow-xl">
                                        <div className="p-4 border-b border-vca-border-dark bg-[#192233]">
                                            <h3 className="font-bold text-white text-sm">Evidence Report</h3>
                                        </div>
                                        <div className="p-6 space-y-0">
                                            {/* Creator Name */}
                                            {report.creator_info?.name && (
                                                <div className="flex justify-between items-center py-2.5 border-b border-slate-800">
                                                    <span className="text-slate-400 text-sm">Creator</span>
                                                    <span className="text-white text-sm font-medium">{report.creator_info.name}</span>
                                                </div>
                                            )}

                                            {/* Creator Email */}
                                            {report.creator_email && (
                                                <div className="flex justify-between items-center py-2.5 border-b border-slate-800">
                                                    <span className="text-slate-400 text-sm">Creator Email</span>
                                                    <span className="text-slate-300 text-sm">{report.creator_email}</span>
                                                </div>
                                            )}

                                            {/* Similarity % for soft matches */}
                                            {report.match_type === "similar" && report.message && (
                                                <div className="flex justify-between items-center py-2.5 border-b border-slate-800">
                                                    <span className="text-slate-400 text-sm">Similarity</span>
                                                    <span className="text-yellow-400 text-sm font-mono font-bold">
                                                        {report.message.match(/(\d+\.\d+)%/)?.[1] ?? "—"}%
                                                    </span>
                                                </div>
                                            )}

                                            {/* Match Type */}
                                            <div className="flex justify-between items-center py-2.5 border-b border-slate-800">
                                                <span className="text-slate-400 text-sm">Match Type</span>
                                                <span className={cn(
                                                    "text-sm font-bold",
                                                    report.match_type === "exact" ? "text-green-500" : "text-yellow-500"
                                                )}>
                                                    {report.match_type === "exact" ? "Exact SHA-256" : "pHash Similar"}
                                                </span>
                                            </div>

                                            {/* Signature Validity */}
                                            {report.signature_valid !== undefined && (
                                                <div className="flex justify-between items-center py-2.5 border-b border-slate-800">
                                                    <span className="text-slate-400 text-sm flex items-center gap-2">
                                                        <FileSignature className="w-3 h-3" />
                                                        Signature
                                                    </span>
                                                    <span className={cn(
                                                        "text-sm font-bold",
                                                        report.signature_valid ? "text-green-500" : "text-red-500"
                                                    )}>
                                                        {report.signature_valid ? "✓ Valid" : "✗ Invalid"}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Manifest Hash */}
                                            {report.manifest_hash && (
                                                <div className="flex justify-between items-center py-2.5 border-b border-slate-800">
                                                    <span className="text-slate-400 text-sm flex items-center gap-2">
                                                        <Fingerprint className="w-3 h-3" />
                                                        Manifest Hash
                                                    </span>
                                                    <code className="text-slate-300 text-xs font-mono">{report.manifest_hash.substring(0, 24)}...</code>
                                                </div>
                                            )}

                                            {/* Key Fingerprint */}
                                            {report.key_fingerprint && (
                                                <div className="flex justify-between items-center py-2.5 border-b border-slate-800">
                                                    <span className="text-slate-400 text-sm flex items-center gap-2">
                                                        <Shield className="w-3 h-3" />
                                                        Key Fingerprint
                                                    </span>
                                                    <code className="text-slate-300 text-xs font-mono">{report.key_fingerprint.substring(0, 20)}...</code>
                                                </div>
                                            )}

                                            {/* Message */}
                                            {report.message && (
                                                <div className="pt-3">
                                                    <p className="text-xs text-slate-400">{report.message}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Download Options */}
                                        <div className="px-6 pb-5 flex gap-3">
                                            <button
                                                onClick={downloadManifest}
                                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
                                                title="Download Manifest JSON"
                                            >
                                                <FileText className="w-4 h-4" />
                                                Manifest JSON
                                            </button>
                                            <button
                                                onClick={downloadPDF}
                                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium transition-colors"
                                                title="Download Certificate PDF"
                                            >
                                                <FileDown className="w-4 h-4" />
                                                Certificate PDF
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Similar Matches */}
                                {report?.matches && report.matches.length > 0 && (
                                    <div className="bg-vca-surface-dark border border-vca-border-dark rounded-xl overflow-hidden shadow-xl">
                                        <div className="p-4 border-b border-vca-border-dark bg-[#192233]">
                                            <h3 className="font-bold text-white text-sm">Similarity Report</h3>
                                        </div>
                                        <div className="p-6">
                                            <p className="text-sm text-slate-300 mb-4">Found {report.matches.length} similar video(s).</p>
                                            {report.matches.map((m: any, i: number) => (
                                                <div key={i} className="p-3 bg-slate-800/50 rounded mb-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-white">{m.filename}</span>
                                                        <span className="text-yellow-500 font-mono text-xs">Dist: {m.distance?.toFixed(2)}</span>
                                                    </div>
                                                    {m.credential_id && (
                                                        <div className="text-xs text-slate-500 mt-1 font-mono">
                                                            ID: {m.credential_id}
                                                        </div>
                                                    )}
                                                    {m.creator_name && (
                                                        <div className="text-xs text-slate-400 mt-0.5">
                                                            Creator: {m.creator_name}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}

function generateVerifyCertPDF(video: any, report: any, jsPDF: any) {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const W = 210, M = 16, CW = W - M * 2
    const NAVY = [12, 35, 75], BLUE = [28, 78, 158], LTBLUE = [232, 238, 250]
    const BLACK = [18, 18, 28], DKGRAY = [55, 65, 80], MIDGRAY = [100, 110, 125]
    const FGRAY = [160, 168, 180], WHITE = [255, 255, 255], GREEN = [22, 115, 65]

    const m = video.manifest || {}
    const iden = m.identity || {}
    const creatorName = iden.creator_name || video.creator_name || report?.creator_info?.name || "Unknown"
    const creatorEmail = video.creator_email || "N/A"
    const credentialId = video.credential_id || report?.credential_id || "N/A"
    const sealedAt = video.sealed_at
        ? new Date(video.sealed_at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })
        : "N/A"
    const genDate = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })

    const sf = (style: string, size: number, color: number[]) => {
        doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color)
    }
    const drawFooter = (label: string) => {
        doc.setDrawColor(...FGRAY); doc.setLineWidth(0.3); doc.line(M, 280, W - M, 280)
        sf("normal", 8, FGRAY); doc.text(`CVPA Verification Certificate  |  ${label}`, M, 286)
        sf("normal", 8, FGRAY); doc.text(`Generated: ${genDate}`, W - M, 286, { align: "right" })
    }
    const techRow = (label: string, value: string, y: number, labelW = 52): number => {
        sf("bold", 9, DKGRAY); doc.text(label, M, y)
        doc.setFont("courier", "normal"); doc.setFontSize(8.5); doc.setTextColor(...BLACK)
        const lines = doc.splitTextToSize(value || "N/A", CW - labelW)
        doc.text(lines, M + labelW, y)
        doc.setDrawColor(230, 234, 242); doc.setLineWidth(0.2); doc.line(M, y + 3.5, W - M, y + 3.5)
        return y + 7 * lines.length + 2
    }

    // Header
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 34, "F")
    sf("bold", 18, WHITE); doc.text("CVPA Verification Certificate", M, 16)
    doc.setDrawColor(60, 90, 140); doc.setLineWidth(0.3); doc.line(M, 19, W - M, 19)
    sf("normal", 9, [160, 180, 210]); doc.text(`Verified: ${genDate}`, M, 27)

    const statusColor = report?.status === "verified" ? GREEN : [180, 120, 0]
    const statusText = report?.status === "verified" ? "VERIFIED" : "WARNING"
    const badgeW = 42, badgeH = 14, badgeX = W - M - badgeW, badgeY = 10
    doc.setFillColor(...statusColor); doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3, 3, "F")
    sf("bold", 10, WHITE); doc.text(statusText, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1.5, { align: "center" })

    sf("normal", 8, MIDGRAY); doc.text("Verification Evidence Report — CVPA System", M, 40)

    let y = 50
    doc.setFillColor(...LTBLUE); doc.roundedRect(M, y, CW, 14, 2, 2, "F")
    sf("normal", 10, NAVY)
    doc.text("This certificate confirms the result of a CVPA integrity verification for the video below.", M + 5, y + 9, { maxWidth: CW - 10 })
    y += 22

    // Video & Creator Details
    doc.setFillColor(...BLUE); doc.rect(M, y - 3, 3, 7, "F")
    sf("bold", 10, NAVY); doc.text("VIDEO & CREATOR DETAILS", M + 6, y + 1)
    doc.setDrawColor(...LTBLUE); doc.setLineWidth(0.4); doc.line(M + 6, y + 2.5, W - M, y + 2.5)
    y += 10

    y = techRow("Credential ID",  credentialId,                    y)
    y = techRow("File Name",      video.filename || "N/A",         y)
    y = techRow("Creator",        creatorName,                     y)
    y = techRow("Creator Email",  creatorEmail,                    y)
    y = techRow("Date Sealed",    sealedAt,                        y)
    y += 5

    // Verification Result
    doc.setFillColor(...BLUE); doc.rect(M, y - 3, 3, 7, "F")
    sf("bold", 10, NAVY); doc.text("VERIFICATION RESULT", M + 6, y + 1)
    doc.setDrawColor(...LTBLUE); doc.setLineWidth(0.4); doc.line(M + 6, y + 2.5, W - M, y + 2.5)
    y += 10

    y = techRow("Status",         report?.status?.toUpperCase() || "N/A",                                y)
    y = techRow("Match Type",     report?.match_type === "exact" ? "Exact SHA-256" : "pHash Similar",   y)
    y = techRow("Signature",      report?.signature_valid ? "Valid ✓" : "Invalid ✗",                    y)
    if (report?.message?.includes("%")) {
        const sim = report.message.match(/(\d+\.\d+)%/)?.[1]
        if (sim) y = techRow("Similarity", `${sim}%`, y)
    }
    y = techRow("Manifest Hash",  video.manifest_hash || report?.manifest_hash || "N/A",                y)
    y = techRow("Key Fingerprint",video.key_fingerprint || report?.key_fingerprint || "N/A",            y)
    y += 5

    // Message
    if (report?.message) {
        doc.setFillColor(...LTBLUE); doc.roundedRect(M, y, CW, 12, 2, 2, "F")
        sf("normal", 9, NAVY); doc.text(report.message, M + 5, y + 8, { maxWidth: CW - 10 })
        y += 18
    }

    drawFooter("Page 1 of 1")
    doc.save(`cvpa-verification-${credentialId.slice(0, 12)}.pdf`)
}
