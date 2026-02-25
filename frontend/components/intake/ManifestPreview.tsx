export function ManifestPreview({ manifest }: { manifest: string | null }) {
    return (
        <div className="bg-white dark:bg-vca-surface-dark rounded-xl border border-vca-border-dark p-1 shadow-sm opacity-90 h-full flex flex-col">
            <div className="px-4 py-3 border-b border-vca-border-dark flex justify-between items-center bg-[#192233]">
                <h4 className="font-bold text-sm text-slate-300">Manifest Preview</h4>
                <span className="text-xs text-slate-500 font-mono">C2PA Standard</span>
            </div>
            <div className="bg-[#0f1219] p-4 m-1 rounded-lg font-mono text-[10px] leading-relaxed text-slate-400 overflow-hidden relative flex-1">
                {manifest ? (
                    <pre className="whitespace-pre-wrap break-all">{manifest}</pre>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600">
                        <p>Waiting for signature...</p>
                        <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-slate-500 animate-spin" />
                    </div>
                )}

                {/* Blur Overlay if not ready (handled by parent logic, but here for visual style if null) */}
                {!manifest && (
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="bg-black/50 text-white px-3 py-1 rounded text-xs backdrop-blur-md border border-white/10">Pending Calculation</span>
                    </div>
                )}
            </div>
        </div>
    )
}
