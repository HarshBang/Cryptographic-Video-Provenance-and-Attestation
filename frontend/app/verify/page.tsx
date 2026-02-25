"use client"

import { useState } from "react"
import { Upload, CheckCircle, AlertTriangle, XCircle, Search, FileVideo, Shield, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

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
                    // Dynamic import to avoid SSR issues if api uses browser globals
                    const API_BASE_URL = "http://localhost:8000/api"
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

    return (
        <div className="min-h-screen bg-vca-bg-dark flex flex-col">
            {/* Header */}
            <header className="border-b border-vca-border-dark bg-[#111722]">
                <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <Shield className="w-6 h-6 text-primary" />
                        <span className="font-bold text-white text-lg">Provenance Verify</span>
                    </Link>
                    <div className="flex gap-4">
                        <Link href="/dashboard" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Creator Login</Link>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[800px] mx-auto px-6 py-12 flex flex-col items-center">
                <div className="text-center mb-10 space-y-2">
                    <h1 className="text-3xl md:text-4xl font-bold text-white">Verify Video Integrity</h1>
                    <p className="text-vca-text-secondary text-lg">Check if a video has been modified or tampered with.</p>
                </div>

                {/* Upload Zone */}
                {status === "idle" && (
                    <div
                        onClick={handleFileSelect}
                        className="w-full h-80 border-2 border-dashed border-vca-border-dark rounded-2xl bg-vca-surface-dark flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-white/5 transition-all group"
                    >
                        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Search className="w-8 h-8 text-slate-400 group-hover:text-primary transition-colors" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Upload Video to Verify</h3>
                        <p className="text-slate-400 text-sm">Supports MP4, MOV, WEBM</p>
                    </div>
                )}

                {/* Analyzing State */}
                {status === "analyzing" && (
                    <div className="w-full h-80 rounded-2xl bg-vca-surface-dark border border-vca-border-dark flex flex-col items-center justify-center space-y-6">
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

                {/* Result State */}
                {status === "result" && (
                    <div className="w-full space-y-6">
                        {/* Status Card */}
                        <div className={cn(
                            "rounded-2xl border p-8 text-center space-y-4",
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
                                    {resultType === "unknown" && "This video has not been signed by the VCA system."}
                                    {resultType === "error" && "Could not process the video file."}
                                </p>
                            </div>
                        </div>

                        {/* Evidence Details */}
                        {resultType === "verified" && report?.metadata && (
                            <div className="bg-vca-surface-dark border border-vca-border-dark rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-vca-border-dark bg-[#192233]">
                                    <h3 className="font-bold text-white text-sm">Evidence Report</h3>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="flex justify-between items-center py-2 border-b border-slate-800">
                                        <span className="text-slate-400 text-sm">Original Filename</span>
                                        <span className="text-white text-sm font-medium">{report.metadata.filename}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-slate-800">
                                        <span className="text-slate-400 text-sm">SHA-256 Hash</span>
                                        <code className="text-primary text-xs font-mono">{report.metadata.sha256.substring(0, 20)}...</code>
                                    </div>
                                    <div className="flex justify-between items-center py-2">
                                        <span className="text-slate-400 text-sm">Content Match</span>
                                        <span className="text-sm font-bold text-green-500">100% Exact Match</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {resultType === "warning" && report?.matches && (
                            <div className="bg-vca-surface-dark border border-vca-border-dark rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-vca-border-dark bg-[#192233]">
                                    <h3 className="font-bold text-white text-sm">Similarity Report</h3>
                                </div>
                                <div className="p-6">
                                    <p className="text-sm text-slate-300 mb-4">Found {report.matches.length} similar video(s) signed by our creators.</p>
                                    {report.matches.map((m: any, i: number) => (
                                        <div key={i} className="p-3 bg-slate-800/50 rounded mb-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-white">{m.filename}</span>
                                                <span className="text-yellow-500 font-mono">Distance: {m.distance}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => setStatus("idle")}
                            className="w-full py-4 text-slate-400 hover:text-white font-medium transition-colors"
                        >
                            Check another video
                        </button>
                    </div>
                )}
            </main>
        </div>
    )
}
