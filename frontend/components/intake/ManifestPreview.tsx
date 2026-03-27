import { CheckCircle, Fingerprint, FileSignature } from "lucide-react"

interface ManifestPreviewProps {
    manifest: any
    signatureResult?: any
}

export function ManifestPreview({ manifest, signatureResult }: ManifestPreviewProps) {
    // Format manifest for display
    const manifestDisplay = typeof manifest === 'string' 
        ? manifest 
        : (manifest ? JSON.stringify(manifest, null, 2) : null)

    return (
        <div className="bg-white dark:bg-vca-surface-dark rounded-xl border border-vca-border-dark p-1 shadow-sm opacity-90 h-full flex flex-col">
            <div className="px-4 py-3 border-b border-vca-border-dark flex justify-between items-center bg-[#192233]">
                <h4 className="font-bold text-sm text-slate-300">Live Manifest Log</h4>
                <span className="text-xs text-slate-500 font-mono">Real-time binding</span>
            </div>
            
            {/* Phase 2: Signature Result Display */}
            {signatureResult && (
                <div className="px-4 py-3 bg-vca-success/10 border-b border-vca-success/20">
                    <div className="flex items-center gap-2 text-vca-success mb-2">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs font-bold">Signature Valid</span>
                    </div>
                    <div className="space-y-1 text-[10px] font-mono text-slate-400">
                        <div className="flex items-center gap-2">
                            <Fingerprint className="w-3 h-3" />
                            <span>Hash: {signatureResult.manifest_hash?.substring(0, 24)}...</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <FileSignature className="w-3 h-3" />
                            <span>Sig: {signatureResult.signature?.substring(0, 24)}...</span>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="bg-[#0f1219] p-4 m-1 rounded-lg font-mono text-[10px] leading-relaxed text-slate-400 overflow-y-auto max-h-[300px] min-h-[300px] relative flex-1 custom-scrollbar">
                {manifestDisplay ? (
                    <pre className="whitespace-pre-wrap break-all">{manifestDisplay}</pre>
                ) : (
                    <div className="flex flex-col justify-center h-full gap-5 text-slate-500 px-6 py-4">
                        <p className="text-sm font-bold text-white/80 mb-1">Awaiting Metadata generation...</p>
                        
                        <div className="flex items-center gap-3 text-xs tracking-wide">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                            1. System Ingestion
                        </div>
                        <div className="flex items-center gap-3 text-xs tracking-wide">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ animationDelay: '200ms' }} />
                            2. SHA-256 Hard Binding
                        </div>
                        <div className="flex items-center gap-3 text-xs tracking-wide">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ animationDelay: '400ms' }} />
                            3. Time-Based Frame Sampling
                        </div>
                        <div className="flex items-center gap-3 text-xs tracking-wide">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ animationDelay: '600ms' }} />
                            4. dHash Soft Binding
                        </div>
                    </div>
                )}

                {/* Blur Overlay if not ready */}
                {!manifest && (
                    <div className="absolute inset-0 bg-[#0f1219]/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
                        <span className="bg-black/80 text-white px-4 py-1.5 rounded-full text-xs font-bold font-sans tracking-wide border border-white/10 shadow-xl">Computing Bindings</span>
                    </div>
                )}
            </div>
        </div>
    )
}
