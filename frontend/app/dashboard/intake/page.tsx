"use client"

import { IntakeWizard } from "@/components/intake/IntakeWizard"
import { useState, useEffect } from "react"
import { Fingerprint, Loader2 } from "lucide-react"
import { getMyIdentity } from "@/lib/api"

export default function IntakePage() {
    const [identity, setIdentity] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const initIdentity = async () => {
            try {
                const data = await getMyIdentity();
                setIdentity(data);
            } catch (e) {
                console.error("Failed to load identity", e);
            } finally {
                setLoading(false);
            }
        };
        initIdentity();
    }, []);

    return (
        <>


            {/* Show active identity */}
            {loading ? (
                <div className="mb-8 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                    <p className="text-sm font-medium text-slate-300">Retrieving Creator Identity...</p>
                </div>
            ) : identity ? (
                <div className="mb-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Fingerprint className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-blue-300">Identity Active</p>
                            <p className="text-xs text-blue-300/70 font-mono">
                                {identity.public_key.substring(0, 16)}...{identity.public_key.slice(-8)}
                            </p>
                        </div>
                    </div>
                    <div className="text-xs font-semibold px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full">
                        {identity.display_name}
                    </div>
                </div>
            ) : (
                <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-sm text-red-400">Error loading identity.</p>
                </div>
            )}

            <IntakeWizard hasIdentity={!!identity} />
        </>
    )
}
