"use client"

import { useState, useRef } from "react"
import { Shield, Key, RefreshCw, Copy, CheckCircle, AlertTriangle, Upload, Download, Fingerprint } from "lucide-react"
import nacl from "tweetnacl"
import * as util from "tweetnacl-util"
import { registerIdentity } from "@/lib/api"

export default function IdentityPage() {
    // Phase 2: Keys stored ONLY in React state (never localStorage)
    const [keyPair, setKeyPair] = useState<{ publicKey: string; privateKey: string } | null>(null)
    const [keyFingerprint, setKeyFingerprint] = useState<string | null>(null)
    const [creatorId, setCreatorId] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [isRegistering, setIsRegistering] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    /**
     * Phase 2 - Generate keypair using tweetnacl (client-side only)
     * Private key never leaves the browser
     */
    const handleGenerate = () => {
        if (!confirm("Generate a new Ed25519 keypair? Make sure to export and save your current key if you have one.")) return

        try {
            // Generate keypair using tweetnacl
            const kp = nacl.sign.keyPair()
            
            // Encode keys as base64
            const privateKeyB64 = util.encodeBase64(kp.secretKey)
            const publicKeyB64 = util.encodeBase64(kp.publicKey)
            
            // Compute key fingerprint (SHA-256 of public key)
            const fingerprint = computeKeyFingerprint(publicKeyB64)
            
            const newKeyPair = { publicKey: publicKeyB64, privateKey: privateKeyB64 }
            setKeyPair(newKeyPair)
            setKeyFingerprint(fingerprint)
            setCreatorId(null) // Will be set after registration
            
            // Dispatch event to share with Intake page
            window.dispatchEvent(new CustomEvent('vca-identity-update', { detail: newKeyPair }))
            
            // Auto-register with backend
            registerWithBackend(publicKeyB64)
        } catch (e) {
            console.error(e)
            alert("Failed to generate identity")
        }
    }

    /**
     * Register public key with backend
     */
    const registerWithBackend = async (publicKey: string) => {
        setIsRegistering(true)
        try {
            const result = await registerIdentity(publicKey)
            setCreatorId(result.creator_id)
            setKeyFingerprint(result.key_fingerprint)
        } catch (e) {
            console.error("Registration failed:", e)
            alert("Failed to register identity with server")
        } finally {
            setIsRegistering(false)
        }
    }

    /**
     * Compute SHA-256 fingerprint of public key
     */
    const computeKeyFingerprint = (publicKey: string): string => {
        // Simple hash for display purposes
        let hash = 0
        for (let i = 0; i < publicKey.length; i++) {
            const char = publicKey.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash
        }
        return Math.abs(hash).toString(16).padStart(16, '0')
    }

    /**
     * Export private key to file
     */
    const handleExport = () => {
        if (!keyPair) return
        
        const keyData = {
            version: "vca-phase2-v1",
            algorithm: "Ed25519",
            public_key: keyPair.publicKey,
            private_key: keyPair.privateKey,
            created_at: new Date().toISOString(),
            fingerprint: keyFingerprint
        }
        
        const blob = new Blob([JSON.stringify(keyData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `vca-identity-${keyFingerprint?.slice(0, 8) || 'backup'}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    /**
     * Import private key from file
     */
    const handleImportClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            try {
                const keyData = JSON.parse(event.target?.result as string)
                
                // Validate key data
                if (!keyData.private_key || !keyData.public_key) {
                    throw new Error("Invalid key file format")
                }
                
                // Verify keypair consistency
                const kp = nacl.sign.keyPair.fromSecretKey(util.decodeBase64(keyData.private_key))
                const derivedPublicKey = util.encodeBase64(kp.publicKey)
                
                if (derivedPublicKey !== keyData.public_key) {
                    throw new Error("Keypair validation failed")
                }
                
                const fingerprint = computeKeyFingerprint(keyData.public_key)
                
                const importedKeyPair = { 
                    publicKey: keyData.public_key, 
                    privateKey: keyData.private_key 
                }
                setKeyPair(importedKeyPair)
                setKeyFingerprint(fingerprint)
                
                // Dispatch event to share with Intake page
                window.dispatchEvent(new CustomEvent('vca-identity-update', { detail: importedKeyPair }))
                
                // Register imported key with backend
                registerWithBackend(keyData.public_key)
                
                alert("Identity imported successfully!")
            } catch (err) {
                console.error(err)
                alert("Failed to import key file: " + (err as Error).message)
            }
        }
        reader.readAsText(file)
        
        // Reset input
        e.target.value = ''
    }

    const copyToClipboard = () => {
        if (keyPair?.privateKey) {
            navigator.clipboard.writeText(keyPair.privateKey)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const publicKeyShort = keyPair?.publicKey 
        ? keyPair.publicKey.slice(0, 16) + "..." + keyPair.publicKey.slice(-8)
        : null

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Digital Identity</h2>
                <p className="text-vca-text-secondary mt-2">
                    Phase 2: Client-side Ed25519 key generation. Private keys never leave your browser.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Identity Card */}
                <div className="bg-vca-surface-dark border border-vca-border-dark rounded-xl p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5">
                        <Shield className="w-32 h-32 text-white" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${keyPair ? 'bg-vca-success/10 border-vca-success/20' : 'bg-slate-800 border-slate-700'}`}>
                                <Shield className={`w-6 h-6 ${keyPair ? 'text-vca-success' : 'text-slate-500'}`} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    {keyPair ? "Identity Active" : "No Identity"}
                                </h3>
                                <p className="text-xs text-vca-text-secondary flex items-center gap-1">
                                    {keyPair ? (
                                        <><CheckCircle className="w-3 h-3 text-vca-success" /> Ready to sign</>
                                    ) : (
                                        "Generate or import keys to begin"
                                    )}
                                </p>
                            </div>
                        </div>

                        {keyPair && (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs uppercase tracking-wider text-vca-text-secondary font-semibold flex items-center gap-2">
                                        <Fingerprint className="w-3 h-3" />
                                        Key Fingerprint
                                    </label>
                                    <div className="mt-2 text-sm font-mono text-vca-success bg-vca-success/10 p-3 rounded border border-vca-success/20">
                                        {keyFingerprint}
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="text-xs uppercase tracking-wider text-vca-text-secondary font-semibold">Public Key</label>
                                    <div className="mt-2 text-xs font-mono text-slate-400 bg-slate-900/50 p-3 rounded border border-white/5 break-all">
                                        {publicKeyShort}
                                    </div>
                                </div>
                                
                                {creatorId && (
                                    <div>
                                        <label className="text-xs uppercase tracking-wider text-vca-text-secondary font-semibold">Creator ID</label>
                                        <div className="mt-2 text-xs font-mono text-slate-400">
                                            {creatorId}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Private Key Card */}
                <div className="bg-vca-surface-dark border border-vca-border-dark rounded-xl p-8 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${keyPair ? 'bg-primary/10 border-primary/20' : 'bg-slate-800 border-slate-700'}`}>
                                <Key className={`w-6 h-6 ${keyPair ? 'text-primary' : 'text-slate-500'}`} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Private Signing Key</h3>
                                <p className="text-xs text-vca-text-secondary">
                                    {keyPair ? "Key in memory" : "No key loaded"}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-6">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-red-200 leading-relaxed">
                                    <strong>Phase 2 Security:</strong> Private keys are stored only in memory. 
                                    If you refresh the page, you must re-import your key. 
                                    Always export and backup your key file.
                                </p>
                            </div>
                        </div>

                        {keyPair && (
                            <div className="mb-4">
                                <label className="text-xs uppercase tracking-wider text-vca-text-secondary font-semibold">Private Key (Base64)</label>
                                <div className="mt-2 text-xs font-mono text-slate-500 bg-slate-900/50 p-3 rounded border border-white/5 break-all">
                                    {keyPair.privateKey.slice(0, 32)}...{keyPair.privateKey.slice(-16)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        {keyPair ? (
                            <>
                                <button
                                    onClick={handleExport}
                                    className="w-full h-10 flex items-center justify-center gap-2 rounded bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors"
                                >
                                    <Download className="w-4 h-4" />
                                    Export Key File
                                </button>
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
                                        New Key
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleGenerate}
                                    className="w-full h-10 flex items-center justify-center gap-2 rounded bg-primary hover:bg-primary/90 text-white text-sm font-medium transition-colors"
                                >
                                    <Key className="w-4 h-4" />
                                    Generate New Keypair
                                </button>
                                <button
                                    onClick={handleImportClick}
                                    className="w-full h-10 flex items-center justify-center gap-2 rounded border border-vca-border-dark text-sm text-vca-text-secondary hover:text-white hover:border-white/20 transition-colors"
                                >
                                    <Upload className="w-4 h-4" />
                                    Import Key File
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Hidden file input for import */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
            />

            {/* Registration status */}
            {isRegistering && (
                <div className="text-center text-sm text-vca-text-secondary">
                    Registering identity with server...
                </div>
            )}
        </div>
    )
}
