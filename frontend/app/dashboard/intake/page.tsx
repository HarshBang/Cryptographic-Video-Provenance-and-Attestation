"use client"

import { IntakeWizard } from "@/components/intake/IntakeWizard"
import { useState, useRef } from "react"
import { Upload, Key, Shield, Fingerprint } from "lucide-react"
import nacl from "tweetnacl"
import * as util from "tweetnacl-util"

// Phase 2: KeyPair interface for client-side signing
interface KeyPair {
    publicKey: string
    privateKey: string
}

export default function IntakePage() {
    const [keyPair, setKeyPair] = useState<KeyPair | null>(null)
    const [showKeyInput, setShowKeyInput] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    /**
     * Generate new keypair directly on intake page
     */
    const handleGenerateKey = () => {
        try {
            const kp = nacl.sign.keyPair()
            const newKeyPair = {
                publicKey: util.encodeBase64(kp.publicKey),
                privateKey: util.encodeBase64(kp.secretKey)
            }
            setKeyPair(newKeyPair)
        } catch (e) {
            console.error(e)
            alert("Failed to generate keypair")
        }
    }

    /**
     * Import key from file
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
                if (!keyData.private_key || !keyData.public_key) {
                    throw new Error("Invalid key file format")
                }
                
                // Verify keypair
                const kp = nacl.sign.keyPair.fromSecretKey(util.decodeBase64(keyData.private_key))
                const derivedPublicKey = util.encodeBase64(kp.publicKey)
                
                if (derivedPublicKey !== keyData.public_key) {
                    throw new Error("Keypair validation failed")
                }
                
                setKeyPair({
                    publicKey: keyData.public_key,
                    privateKey: keyData.private_key
                })
            } catch (err) {
                alert("Failed to import key: " + (err as Error).message)
            }
        }
        reader.readAsText(file)
        e.target.value = ''
    }

    const keyFingerprint = keyPair ? 
        keyPair.publicKey.slice(0, 16) + "..." + keyPair.publicKey.slice(-8) 
        : null

    return (
        <>
            <div className="mb-10">
                <h1 className="text-3xl md:text-4xl font-bold mb-2 text-white">New Video Intake</h1>
                <p className="text-vca-text-secondary text-lg">
                    Phase 2: Client-side signing. Generate cryptographic proofs and digitally seal your content.
                </p>
            </div>

            {/* Phase 2: Key Management on Intake Page */}
            {!keyPair && (
                <div className="mb-8 p-6 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                            <Key className="w-6 h-6 text-amber-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-amber-200 mb-2">Identity Required</h3>
                            <p className="text-sm text-amber-200/70 mb-4">
                                You need an Ed25519 keypair to sign videos. The private key stays in your browser and is never sent to the server.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleGenerateKey}
                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Shield className="w-4 h-4" />
                                    Generate New Key
                                </button>
                                <button
                                    onClick={handleImportClick}
                                    className="px-4 py-2 border border-amber-500/30 hover:bg-amber-500/10 text-amber-300 font-medium rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Upload className="w-4 h-4" />
                                    Import Key File
                                </button>
                            </div>
                        </div>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileImport}
                        className="hidden"
                    />
                </div>
            )}

            {/* Show active key */}
            {keyPair && (
                <div className="mb-8 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Fingerprint className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-green-300">Identity Active</p>
                            <p className="text-xs text-green-300/70 font-mono">{keyFingerprint}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setKeyPair(null)}
                        className="text-xs text-green-300/70 hover:text-green-300 underline"
                    >
                        Change Key
                    </button>
                </div>
            )}

            <IntakeWizard keyPair={keyPair} />
        </>
    )
}
