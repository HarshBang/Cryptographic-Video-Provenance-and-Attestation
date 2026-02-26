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
                <h4 className="font-bold text-sm text-slate-300">Manifest Preview</h4>
                <span className="text-xs text-slate-500 font-mono">Phase 2</span>
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
            
            <div className="bg-[#0f1219] p-4 m-1 rounded-lg font-mono text-[10px] leading-relaxed text-slate-400 overflow-hidden relative flex-1">
                {manifestDisplay ? (
                    <pre className="whitespace-pre-wrap break-all">{manifestDisplay}</pre>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600">
                        <p>Waiting for processing...</p>
                        <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-slate-500 animate-spin" />
                    </div>
                )}

                {/* Blur Overlay if not ready */}
                {!manifest && (
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="bg-black/50 text-white px-3 py-1 rounded text-xs backdrop-blur-md border border-white/10">Pending Calculation</span>
                    </div>
                )}
            </div>
        </div>
    )
}
