"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface LogEntry {
    id: string
    timestamp: string
    message: string
    type: "info" | "success" | "warning" | "error" | "process"
}

interface TerminalLogProps {
    logs: LogEntry[]
    processing: boolean
}

export function TerminalLog({ logs, processing }: TerminalLogProps) {
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [logs])

    return (
        <div className="bg-[#0f1219] rounded-xl border border-slate-800 p-4 font-mono text-xs shadow-inner h-64 flex flex-col">
            {/* Terminal Header */}
            <div className="flex items-center gap-1.5 mb-4 border-b border-slate-800 pb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50" />
                <span className="ml-2 text-slate-500">provenance-cli — v2.4.1</span>
            </div>

            {/* Log Output */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                {logs.map((log) => (
                    <p key={log.id} className="break-all font-mono">
                        <span className="text-slate-500 mr-2">[{log.timestamp}]</span>
                        {log.type === "process" && (
                            <>
                                <span className="text-vca-success">➜</span> <span className="text-primary">~</span>{" "}
                            </>
                        )}
                        <span
                            className={cn(
                                "text-slate-300",
                                log.type === "success" && "text-vca-success",
                                log.type === "warning" && "text-yellow-400",
                                log.type === "error" && "text-red-400"
                            )}
                        >
                            {log.message}
                        </span>
                    </p>
                ))}
                {processing && (
                    <p className="animate-pulse text-primary mt-1">_</p>
                )}
            </div>
        </div>
    )
}
