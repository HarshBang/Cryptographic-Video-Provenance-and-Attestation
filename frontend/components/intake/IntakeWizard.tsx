"use client"

import { useState, useEffect } from "react"
import { Upload, Check, Loader2, Lock, ShieldCheck, FileVideo, RefreshCw, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { TerminalLog } from "./TerminalLog"
import { ManifestPreview } from "./ManifestPreview"

// Mock Logs
// Mock Logs
interface LogEntry {
    id: string
    timestamp: string
    message: string
    type: "info" | "success" | "warning" | "error" | "process"
}

const STARTUP_LOGS: LogEntry[] = [
    { id: "1", timestamp: "14:30:00", message: "Initializing secure environment...", type: "process" },
    { id: "2", timestamp: "14:30:01", message: "Environment checks passed.", type: "info" },
]

export function IntakeWizard() {
    const [step, setStep] = useState(1) // 1: Upload, 2: Processing, 3: Seal
    const [file, setFile] = useState<File | null>(null)
    const [taskId, setTaskId] = useState<string | null>(null)
    const [progress, setProgress] = useState({ hash: 0, frames: 0, phash: 0 })
    const [logs, setLogs] = useState<LogEntry[]>(STARTUP_LOGS)
    const [manifest, setManifest] = useState<string | null>(null)
    const [privateKey, setPrivateKey] = useState<string | null>(null)
    const [signing, setSigning] = useState(false)

    // Identity Init
    useEffect(() => {
        const storedKey = localStorage.getItem("vca_private_key")
        if (storedKey) {
            setPrivateKey(storedKey)
        } else {
            import("../../lib/api").then(api => {
                api.generateIdentity().then(id => {
                    localStorage.setItem("vca_private_key", id.private_key)
                    setPrivateKey(id.private_key)
                })
            })
        }
    }, [])

    const addLog = (msg: string, type: "info" | "process" | "success" | "error" = "info") => {
        setLogs(prev => [...prev, {
            id: Math.random().toString(36),
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            message: msg,
            type: type
        }])
    }

    // Step 2: Processing Logic (Polling)
    useEffect(() => {
        if (step === 2 && taskId) {
            let interval: NodeJS.Timeout

            const poll = async () => {
                try {
                    const { pollStatus } = await import("../../lib/api")
                    const status = await pollStatus(taskId)

                    if (status.step) {
                        // Simple deduplication of logs could be added here
                        // For now, we just rely on the step change or progress
                    }

                    // Update Progress Bars based on backend "progress" value
                    // Mapping backend single progress (0-100) to our multi-bar UI
                    // 0-40: Hashing
                    // 40-70: Frames
                    // 70-100: pHash
                    const p = status.progress || 0

                    // Update logs based on phase transitions (heuristic)
                    if (p > 0 && p < 40 && progress.hash === 0) addLog("Starting SHA-256 calculation...", "process")
                    if (p >= 40 && progress.hash < 40) addLog("SHA-256 calculation complete.", "success")
                    if (p > 40 && p < 70 && progress.frames === 0) addLog("Extracting sparse keyframes...", "process")
                    if (p > 70 && p < 100 && progress.phash === 0) addLog("Calculating perceptual hash...", "process")

                    setProgress({
                        hash: Math.min(p * 2.5, 100),
                        frames: p > 40 ? Math.min((p - 40) * 3.3, 100) : 0,
                        phash: p > 70 ? Math.min((p - 70) * 3.3, 100) : 0
                    })

                    if (status.status === "complete") {
                        clearInterval(interval)
                        addLog("Processing complete. Manifest generated.", "success")
                        // Prepare Manifest preview
                        setManifest(JSON.stringify({
                            "status": "ready_to_sign",
                            "asset": status.result
                        }, null, 2))
                        setTimeout(() => setStep(3), 1000)
                    }

                    if (status.status === "error") {
                        clearInterval(interval)
                        addLog(`Error: ${status.error}`, "error")
                    }

                } catch (e) {
                    console.error(e)
                }
            }

            interval = setInterval(poll, 1000)
            return () => clearInterval(interval)
        }
    }, [step, taskId, progress])

    const handleFileSelect = async () => {
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
                    const { uploadVideo } = await import("../../lib/api")
                    const res = await uploadVideo(selectedFile)
                    setTaskId(res.task_id)
                    addLog("Upload complete. Queued for processing.", "success")
                } catch (e) {
                    addLog(`Upload failed: ${e}`, "error")
                    setStep(1) // Reset
                }
            }
        }
        input.click()
    }

    const handleSign = async () => {
        if (!taskId || !privateKey) return
        setSigning(true)
        addLog("Signing manifest with Ed25519 key...", "process")

        try {
            const { signManifest } = await import("../../lib/api")
            // Mock deriving DID from key for display purposes
            const mockDid = "did:key:z6Mk" + privateKey.substring(0, 16)
            const res = await signManifest(taskId, privateKey, mockDid)

            setManifest(JSON.stringify(res.manifest, null, 2))
            addLog(`Signature generated: ${res.signature.substring(0, 16)}...`, "success")
            addLog("Evidence Pack ready for download.", "info")
            setSigning(false)
        } catch (e) {
            addLog(`Signing failed: ${e}`, "error")
            setSigning(false)
        }
    }

    return (
        <div className="w-full max-w-[960px] mx-auto">
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
                            className="border-2 border-dashed border-vca-border-dark rounded-xl bg-vca-surface-dark h-96 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-white/5 transition-all group"
                        >
                            <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Upload className="w-8 h-8 text-slate-400 group-hover:text-primary transition-colors" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Upload Raw Video</h3>
                            <p className="text-slate-400 text-sm mb-8">Drag and drop or click to browse (MP4, MOV)</p>
                            <div className="px-4 py-2 bg-slate-800 rounded text-xs text-slate-500 font-mono">
                                Max size: 5GB • Secure Pipeline
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
                                        <h3 className="font-bold text-lg text-white">System Activity</h3>
                                    </div>
                                    <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded">
                                        ID: {taskId ? taskId.substring(0, 8) : "INITIALIZING"}
                                    </span>
                                </div>

                                <div className="space-y-6">
                                    <ProgressRow label="Source Ingestion" percent={100} completed={true} />
                                    <ProgressRow label="Generating SHA-256 Hash" percent={progress.hash} active={step === 2 && progress.hash < 100} />
                                    <ProgressRow label="Extracting Sparse Frames" percent={progress.frames} active={step === 2 && progress.frames > 0 && progress.frames < 100} />
                                    <ProgressRow label="Creating pHash Signature" percent={progress.phash} active={step === 2 && progress.phash > 0 && progress.phash < 100} />
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
                    {step >= 2 && <ManifestPreview manifest={manifest} />}

                    {/* Action Card */}
                    <div className="bg-white dark:bg-vca-surface-dark rounded-xl border border-vca-border-dark p-6 shadow-sm">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5 text-slate-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">Ed25519 Signing</p>
                                    <p className="text-xs text-slate-500">High-assurance key pair</p>
                                </div>
                            </div>
                            <div className="h-px bg-slate-700 w-full" />
                            <button
                                onClick={handleSign}
                                className={cn(
                                    "w-full h-12 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all",
                                    step === 3
                                        ? "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                                        : "bg-slate-800 text-slate-500 cursor-not-allowed"
                                )}
                                disabled={step !== 3 || signing}
                            >
                                {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                                {signing ? "Signing..." : (step === 3 ? "Finalize & Sign" : "Waiting...")}
                            </button>
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
