"use client"

import { useState, useEffect } from "react"
import { Upload, Check, Loader2, Lock, ShieldCheck, FileVideo, RefreshCw, CheckCircle, AlertCircle, Fingerprint } from "lucide-react"
import { cn } from "@/lib/utils"
import { TerminalLog } from "./TerminalLog"
import { ManifestPreview } from "./ManifestPreview"
import nacl from "tweetnacl"
import * as util from "tweetnacl-util"

// Phase 2 - Log Entry Interface
interface LogEntry {
    id: string
    timestamp: string
    message: string
    type: "info" | "success" | "warning" | "error" | "process"
}

const STARTUP_LOGS: LogEntry[] = [
    { id: "1", timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }), message: "Phase 2 Client-Side Signing Ready", type: "success" },
    { id: "2", timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }), message: "Waiting for video upload...", type: "info" },
]

// Phase 2 - Keypair from Identity Page (passed via props or context)
interface KeyPair {
    publicKey: string
    privateKey: string
}

interface IntakeWizardProps {
    keyPair?: KeyPair | null
}

export function IntakeWizard({ keyPair }: IntakeWizardProps) {
    const [step, setStep] = useState(1) // 1: Upload, 2: Processing, 3: Seal
    const [file, setFile] = useState<File | null>(null)
    const [taskId, setTaskId] = useState<string | null>(null)
    const [progress, setProgress] = useState({ hash: 0, frames: 0, phash: 0 })
    const [logs, setLogs] = useState<LogEntry[]>(STARTUP_LOGS)
    const [manifest, setManifest] = useState<any>(null)
    const [canonicalManifest, setCanonicalManifest] = useState<string | null>(null)
    const [manifestHash, setManifestHash] = useState<string | null>(null)
    const [signing, setSigning] = useState(false)
    const [signatureResult, setSignatureResult] = useState<any>(null)

    // Phase 2: No auto-identity generation - must be provided from Identity page
    const hasIdentity = !!keyPair

    const addLog = (msg: string, type: "info" | "process" | "success" | "error" | "warning" = "info") => {
        setLogs(prev => [...prev, {
            id: Math.random().toString(36),
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            message: msg,
            type: type
        }])
    }

    // Step 2: Processing Logic (Polling) - Phase 2 Enhanced
    useEffect(() => {
        if (step === 2 && taskId) {
            let interval: NodeJS.Timeout

            const poll = async () => {
                try {
                    const { pollStatus } = await import("../../lib/api")
                    const status = await pollStatus(taskId)

                    // Phase 2: Use phase from backend for better tracking
                    const phase = status.phase || 'pending'
                    const p = status.progress || 0

                    // Update logs based on phase
                    if (phase === 'hashing' && progress.hash === 0) {
                        addLog("Starting SHA-256 calculation (Hard Binding)...", "process")
                    }
                    if (phase === 'frame_extraction' && progress.frames === 0) {
                        addLog("SHA-256 complete. Extracting sparse keyframes...", "success")
                        addLog("Starting time-based frame sampling...", "process")
                    }
                    if (phase === 'phash' && progress.phash === 0) {
                        addLog("Frame extraction complete. Computing dHash sequence...", "success")
                        addLog("Generating perceptual hashes (Soft Binding)...", "process")
                    }

                    // Update progress bars based on phase
                    setProgress({
                        hash: phase === 'hashing' ? Math.min(p * 2.5, 100) : (phase !== 'pending' ? 100 : 0),
                        frames: phase === 'frame_extraction' ? Math.min((p - 30) * 2, 100) : (phase === 'phash' || phase === 'complete' ? 100 : 0),
                        phash: phase === 'phash' ? Math.min((p - 60) * 2.5, 100) : (phase === 'complete' ? 100 : 0)
                    })

                    if (status.status === "complete") {
                        clearInterval(interval)
                        
                        // Phase 2: Handle duplicate detection
                        if (status.result?.duplicate) {
                            addLog(`Video already exists: ${status.result.credential_id}`, "warning")
                            addLog(status.result.message, "info")
                        } else {
                            addLog("Processing complete. Canonical manifest generated.", "success")
                            addLog(`Manifest hash: ${status.result?.manifest_hash?.substring(0, 16)}...`, "info")
                            
                            // Store manifest data for signing
                            setCanonicalManifest(status.result?.canonical_manifest)
                            setManifestHash(status.result?.manifest_hash)
                            setManifest({
                                status: "ready_to_sign",
                                manifest_hash: status.result?.manifest_hash,
                                frame_count: status.result?.frame_count,
                                asset: {
                                    name: status.result?.filename,
                                    sha256: status.result?.sha256,
                                    size: status.result?.size
                                }
                            })
                        }
                        
                        setTimeout(() => setStep(3), 1000)
                    }

                    if (status.status === "error") {
                        clearInterval(interval)
                        addLog(`Error: ${status.error}`, "error")
                    }

                } catch (e: any) {
                    console.error("Polling error:", e)
                    addLog(`Polling error: ${e.message || e}`, "error")
                }
            }

            interval = setInterval(poll, 1000)
            return () => clearInterval(interval)
        }
    }, [step, taskId, progress])

    const handleFileSelect = async () => {
        // Phase 2: Check for identity before upload
        if (!hasIdentity) {
            addLog("ERROR: No identity found. Please generate or import keys in Identity page first.", "error")
            return
        }

        // Trigger hidden file input
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'video/*'
        input.onchange = async (e) => {
            const files = (e.target as HTMLInputElement).files
            if (files && files.length > 0) {
                const selectedFile = files[0]
                setFile(selectedFile)
                setStep(2)

                try {
                    addLog(`Uploading "${selectedFile.name}"...`, "process")
                    console.log("Starting upload for file:", selectedFile.name, "Size:", selectedFile.size)
                    const { uploadVideo } = await import("../../lib/api")
                    const res = await uploadVideo(selectedFile)
                    console.log("Upload response:", res)
                    setTaskId(res.task_id)
                    addLog("Upload complete. Phase 2 processing started.", "success")
                    addLog("Computing SHA-256 and dHash sequence...", "process")
                } catch (e: any) {
                    console.error("Upload error:", e)
                    addLog(`Upload failed: ${e.message || e}`, "error")
                    setStep(1) // Reset
                }
            }
        }
        input.click()
    }

    /**
     * Phase 2 - Client-Side Signing
     * Signs the canonical manifest in the browser using tweetnacl
     * Private key NEVER leaves the browser
     */
    const handleSign = async () => {
        if (!taskId || !keyPair || !canonicalManifest) {
            addLog("Missing required data for signing", "error")
            return
        }

        setSigning(true)
        addLog("Starting client-side signing with Ed25519...", "process")

        try {
            // Step 1: Convert canonical manifest to bytes
            const messageBytes = util.decodeUTF8(canonicalManifest)
            addLog("Canonical manifest encoded to UTF-8", "info")

            // Step 2: Decode private key from base64
            const secretKeyBytes = util.decodeBase64(keyPair.privateKey)
            addLog("Private key decoded", "info")

            // Step 3: Sign using tweetnacl
            const signature = nacl.sign.detached(messageBytes, secretKeyBytes)
            const signatureBase64 = util.encodeBase64(signature)
            addLog(`Signature generated: ${signatureBase64.substring(0, 32)}...`, "success")

            // Step 4: Send signature to backend for verification and storage
            addLog("Sending signature to backend for verification...", "process")
            const { finalizeSignature } = await import("../../lib/api")
            const res = await finalizeSignature(taskId, signatureBase64, keyPair.publicKey)

            // Step 5: Display results
            setSignatureResult({
                credential_id: res.credential_id,
                manifest_hash: res.manifest_hash,
                signature: signatureBase64,
                signature_valid: res.signature_valid,
                public_key: keyPair.publicKey,
                key_fingerprint: res.manifest?.identity?.key_fingerprint
            })

            setManifest(res.manifest)
            
            addLog(`✓ Signature verified by backend`, "success")
            addLog(`✓ Credential ID: ${res.credential_id}`, "success")
            addLog(`✓ Manifest Hash: ${res.manifest_hash?.substring(0, 16)}...`, "success")
            addLog("Evidence Pack sealed and ready!", "success")
            
            setSigning(false)
        } catch (e: any) {
            addLog(`Signing failed: ${e.message || e}`, "error")
            setSigning(false)
        }
    }

    return (
        <div className="w-full max-w-[960px] mx-auto">
            {/* Phase 2 Identity Warning */}
            {!hasIdentity && step === 1 && (
                <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-amber-200 font-medium">Identity Required</p>
                        <p className="text-xs text-amber-200/70 mt-1">
                            Please generate or import an Ed25519 keypair in the Identity page before uploading videos.
                            Private keys are never sent to the server.
                        </p>
                    </div>
                </div>
            )}

            {/* Wizard Stepper */}
            <div className="mb-12">
                <div className="flex items-center w-full">
                    {/* Step 1 */}
                    <StepIndicator number={1} label="Upload" active={step >= 1} completed={step > 1} />
                    <StepConnector active={step > 1} />
                    {/* Step 2 */}
                    <StepIndicator number={2} label="Processing" active={step >= 2} completed={step > 2} />
                    <StepConnector active={step > 2} />
                    {/* Step 3 */}
                    <StepIndicator number={3} label="Digital Seal" active={step >= 3} completed={step > 3} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Step 1: Upload UI */}
                    {step === 1 && (
                        <div
                            onClick={handleFileSelect}
                            className={cn(
                                "border-2 border-dashed rounded-xl h-96 flex flex-col items-center justify-center transition-all group",
                                hasIdentity 
                                    ? "border-vca-border-dark bg-vca-surface-dark cursor-pointer hover:border-primary/50 hover:bg-white/5"
                                    : "border-slate-700 bg-slate-800/50 cursor-not-allowed opacity-60"
                            )}
                        >
                            <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Upload className="w-8 h-8 text-slate-400 group-hover:text-primary transition-colors" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Upload Raw Video</h3>
                            <p className="text-slate-400 text-sm mb-8">Drag and drop or click to browse (MP4, MOV)</p>
                            <div className="px-4 py-2 bg-slate-800 rounded text-xs text-slate-500 font-mono">
                                Phase 2 • Client-Side Signing • Max: 5GB
                            </div>
                        </div>
                    )}

                    {/* Step 2: Processing UI */}
                    {step >= 2 && (
                        <div className="space-y-6">
                            {/* Progress Cards */}
                            <div className="bg-white dark:bg-vca-surface-dark rounded-xl border border-vca-border-dark p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <span className="relative flex h-3 w-3">
                                            {step === 2 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>}
                                            <span className={cn("relative inline-flex rounded-full h-3 w-3", step === 2 ? "bg-primary" : "bg-vca-success")}></span>
                                        </span>
                                        <h3 className="font-bold text-lg text-white">Phase 2 Processing</h3>
                                    </div>
                                    <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded">
                                        ID: {taskId ? taskId.substring(0, 8) : "INITIALIZING"}
                                    </span>
                                </div>

                                <div className="space-y-6">
                                    <ProgressRow label="Source Ingestion" percent={100} completed={true} />
                                    <ProgressRow label="SHA-256 Hard Binding" percent={progress.hash} active={step === 2 && progress.hash < 100} />
                                    <ProgressRow label="Time-Based Frame Sampling" percent={progress.frames} active={step === 2 && progress.frames > 0 && progress.frames < 100} />
                                    <ProgressRow label="dHash Soft Binding" percent={progress.phash} active={step === 2 && progress.phash > 0 && progress.phash < 100} />
                                </div>
                            </div>

                            {/* Terminal */}
                            <TerminalLog logs={logs} processing={step === 2} />
                        </div>
                    )}
                </div>

                {/* Right Sidebar / Actions */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Manifest Preview */}
                    {step >= 2 && <ManifestPreview manifest={manifest} signatureResult={signatureResult} />}

                    {/* Action Card - Phase 2 */}
                    <div className="bg-white dark:bg-vca-surface-dark rounded-xl border border-vca-border-dark p-6 shadow-sm">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5 text-slate-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">Client-Side Signing</p>
                                    <p className="text-xs text-slate-500">Ed25519 • Private key never leaves browser</p>
                                </div>
                            </div>
                            
                            {/* Phase 2: Show key fingerprint if available */}
                            {keyPair && (
                                <div className="p-3 bg-slate-800/50 rounded-lg">
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <Fingerprint className="w-3 h-3" />
                                        <span>Key Active</span>
                                    </div>
                                </div>
                            )}
                            
                            <div className="h-px bg-slate-700 w-full" />
                            <button
                                onClick={handleSign}
                                className={cn(
                                    "w-full h-12 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all",
                                    step === 3 && hasIdentity
                                        ? "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                                        : "bg-slate-800 text-slate-500 cursor-not-allowed"
                                )}
                                disabled={step !== 3 || signing || !hasIdentity}
                            >
                                {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                                {signing ? "Signing in Browser..." : (step === 3 ? "Sign & Finalize" : "Waiting...")}
                            </button>
                            
                            {!hasIdentity && step === 3 && (
                                <p className="text-xs text-amber-400 text-center">
                                    Identity required. Go to Identity page.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function StepIndicator({ number, label, active, completed }: { number: number, label: string, active: boolean, completed: boolean }) {
    return (
        <div className="flex items-center relative">
            <div className={cn(
                "rounded-full transition-all duration-500 ease-in-out size-8 border-2 flex items-center justify-center z-10",
                completed ? "border-primary bg-primary" : active ? "border-primary bg-primary animate-pulse" : "border-slate-700 bg-vca-bg-dark"
            )}>
                {completed ? <Check className="w-4 h-4 text-white" /> : <span className={cn("font-bold text-sm", active ? "text-white" : "text-slate-500")}>{number}</span>}
            </div>
            <div className="absolute top-10 -left-2 w-32 text-xs font-bold uppercase tracking-wider">
                <span className={cn(active || completed ? "text-primary" : "text-slate-600")}>{label}</span>
            </div>
        </div>
    )
}

function StepConnector({ active }: { active: boolean }) {
    return (
        <div className={cn("flex-auto border-t-2 transition-all duration-500 ease-in-out mx-2", active ? "border-primary" : "border-slate-700")} />
    )
}

function ProgressRow({ label, percent, active, completed }: { label: string, percent: number, active?: boolean, completed?: boolean }) {
    return (
        <div>
            <div className="flex justify-between items-end mb-2">
                <span className={cn("text-sm font-medium flex items-center gap-2", completed || percent === 100 ? "text-slate-200" : "text-slate-400")}>
                    {active ? <RefreshCw className="w-3 h-3 animate-spin text-primary" /> : null}
                    {(completed || percent === 100) ? <CheckCircle className="w-3 h-3 text-vca-success" /> : null}
                    {label}
                </span>
                <span className={cn("text-xs font-mono", active ? "text-primary" : "text-slate-500")}>{Math.round(percent)}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                    className={cn("h-1.5 rounded-full transition-all duration-300",
                        completed || percent === 100 ? "bg-vca-success" : "bg-primary"
                    )}
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    )
}
