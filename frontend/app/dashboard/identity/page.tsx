"use client"

import { useState, useEffect } from "react"
import { Shield, Key, RefreshCw, Copy, CheckCircle, AlertTriangle } from "lucide-react"

export default function IdentityPage() {
    const [privateKey, setPrivateKey] = useState<string | null>(null)
    const [publicKey, setPublicKey] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        const storedPriv = localStorage.getItem("vca_private_key")
        if (storedPriv) {
            setPrivateKey(storedPriv)
            // In a real app, we'd derive pub key or store it too. 
            // For now, we just show a placeholder derived string or fetch again if needed.
            setPublicKey("did:key:z6Mk" + storedPriv.substring(0, 16) + "...")
        }
    }, [])

    const handleGenerate = async () => {
        if (!confirm("Warning: Generating a new key will invalidate previous logs for this device. Continue?")) return

        try {
            const { generateIdentity } = await import("@/lib/api")
            const id = await generateIdentity()
            localStorage.setItem("vca_private_key", id.private_key)
            setPrivateKey(id.private_key)
            setPublicKey("did:key:z6Mk" + id.private_key.substring(0, 16) + "...")
        } catch (e) {
            console.error(e)
            alert("Failed to generate identity")
        }
    }

    const copyToClipboard = () => {
        if (privateKey) {
            navigator.clipboard.writeText(privateKey)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Digital Identity</h2>
                <p className="text-vca-text-secondary mt-2">Manage your cryptographic keys used for signing video content.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Identity Card */}
                <div className="bg-vca-surface-dark border border-vca-border-dark rounded-xl p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5">
                        <Shield className="w-32 h-32 text-white" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-full bg-vca-success/10 flex items-center justify-center border border-vca-success/20">
                                <Shield className="w-6 h-6 text-vca-success" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Verified Creator</h3>
                                <p className="text-xs text-vca-success flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Active & Secure
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs uppercase tracking-wider text-vca-text-secondary font-semibold">Public DID (Visible to World)</label>
                                <div className="mt-2 text-sm font-mono text-white bg-slate-900/50 p-3 rounded border border-white/5 break-all">
                                    {publicKey || "Loading..."}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Private Key Card */}
                <div className="bg-vca-surface-dark border border-vca-border-dark rounded-xl p-8 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                                <Key className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Private Signing Key</h3>
                                <p className="text-xs text-vca-text-secondary">Used to seal your Evidence Packs</p>
                            </div>
                        </div>

                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-6">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-red-200 leading-relaxed">
                                    This key is stored locally in your browser. If you clear your cache or lose this device, you will lose the ability to sign as this identity.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={copyToClipboard}
                            className="flex-1 h-10 flex items-center justify-center gap-2 rounded bg-slate-800 text-sm text-white hover:bg-slate-700 transition-colors font-medium"
                        >
                            {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? "Copied" : "Copy Key"}
                        </button>
                        <button
                            onClick={handleGenerate}
                            className="h-10 px-4 flex items-center justify-center gap-2 rounded border border-vca-border-dark text-sm text-vca-text-secondary hover:text-white hover:border-white/20 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Regenerate
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
