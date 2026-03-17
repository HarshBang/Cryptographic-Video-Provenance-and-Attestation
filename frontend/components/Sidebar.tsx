"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Video, Fingerprint, Activity, Settings, Zap } from "lucide-react" // Using Lucide as modern replacement for Material Symbols
import { cn } from "@/lib/utils"

const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    // { name: "My Library", href: "/dashboard", icon: Video },
    { name: "Video Intake", href: "/dashboard/intake", icon: Zap },
    { name: "Identity", href: "/dashboard/identity", icon: Fingerprint },
    { name: "Analytics", href: "/dashboard/analytics", icon: Activity },
]

export function Sidebar() {
    const pathname = usePathname()

    return (
        <aside className="w-64 flex-shrink-0 flex flex-col border-r border-[#2a3649] bg-[#111722] transition-all duration-300 h-screen fixed left-0 top-0 z-50">
            {/* Brand / Profile Header */}
            <div className="p-6 border-b border-[#2a3649] flex items-center gap-3">
                <div className="relative h-10 w-10 rounded-full border border-slate-600 shadow-sm overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500">
                    {/* Placeholder Avatar */}
                    <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs">AC</div>
                </div>
                <div>
                    <h1 className="text-white text-base font-bold leading-tight tracking-tight">CVPA</h1>
                    <p className="text-slate-400 text-xs font-medium">Creator Suite</p>
                </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-1.5">
                {navigation.map((item) => {
                    const isActive = pathname === item.href
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group relative",
                                isActive
                                    ? "bg-[#135bec]/10 text-white border border-[#135bec]/20"
                                    : "text-slate-400 hover:bg-[#161e2e] hover:text-white hover:pl-4"
                            )}
                        >
                            {isActive && (
                                <div className="absolute left-0 w-1 h-6 bg-[#135bec] rounded-r-full" />
                            )}
                            <item.icon
                                className={cn(
                                    "h-5 w-5 transition-colors",
                                    isActive ? "text-[#135bec]" : "group-hover:text-white"
                                )}
                            />
                            <span className="text-sm font-medium">{item.name}</span>
                        </Link>
                    )
                })}
            </nav>

            {/* Bottom Settings */}
            <div className="p-4 border-t border-[#2a3649]">
                <div className="px-3 py-4 rounded-xl bg-gradient-to-br from-[#135bec]/20 to-purple-500/10 border border-[#135bec]/20 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-4 w-4 text-[#0bda5e]" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">System Status</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[#0bda5e] animate-pulse" />
                        <span className="text-xs text-slate-300">All Systems Normal</span>
                    </div>
                </div>

                <Link
                    href="/settings"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#161e2e] transition-colors group text-slate-400 hover:text-white"
                >
                    <Settings className="h-5 w-5 group-hover:rotate-90 transition-transform duration-500" />
                    <p className="text-sm font-medium">Settings</p>
                </Link>
            </div>
        </aside>
    )
}
