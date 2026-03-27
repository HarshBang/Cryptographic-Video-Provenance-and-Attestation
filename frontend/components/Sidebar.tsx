"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { LayoutDashboard, Zap, Settings, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { userPool } from "@/lib/cognito"
import { useEffect, useState } from "react"

const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    // { name: "My Library", href: "/dashboard", icon: Video },
    { name: "Video Intake", href: "/dashboard/intake", icon: Zap },
]

export function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()

    const [creatorName, setCreatorName] = useState("Creator");
    const [creatorInitials, setCreatorInitials] = useState("CR");

    useEffect(() => {
        // Try Cognito SDK session first (email/password login)
        const user = userPool.getCurrentUser();
        if (user) {
            user.getSession((err: any, session: any) => {
                if (!err && session.isValid()) {
                    user.getUserAttributes((err: any, attributes: any) => {
                        if (!err && attributes) {
                            const nameAttr = attributes.find((a: any) => a.getName() === 'name');
                            if (nameAttr) {
                                setCreatorName(nameAttr.getValue());
                                setCreatorInitials(nameAttr.getValue().substring(0, 2).toUpperCase());
                            }
                        }
                    });
                }
            });
        } else {
            // Fall back to OAuth token (Google login)
            const idToken = typeof window !== "undefined" ? localStorage.getItem("cognito_id_token") : null;
            if (idToken) {
                try {
                    const payload = JSON.parse(atob(idToken.split(".")[1]));
                    const name = payload.name || payload.email || "Creator";
                    setCreatorName(name);
                    setCreatorInitials(name.substring(0, 2).toUpperCase());
                } catch {}
            }
        }
    }, []);

    const handleLogout = () => {
        const user = userPool.getCurrentUser();
        if (user) user.signOut();
        localStorage.removeItem("cognito_id_token");
        localStorage.removeItem("cognito_access_token");
        localStorage.removeItem("cognito_refresh_token");
        router.push("/login");
    };

    return (
        <aside className="w-64 flex-shrink-0 flex flex-col border-r border-[#2a3649] bg-[#111722] transition-all duration-300 h-screen fixed left-0 top-0 z-50">
            {/* Brand / Profile Header */}
            <div className="p-6 border-b border-[#2a3649] flex items-center gap-3">
                <div className="relative h-10 w-10 rounded-full border border-slate-600 shadow-sm overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500">
                    <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-xs">{creatorInitials}</div>
                </div>
                <div>
                    <h1 className="text-white text-base font-bold leading-tight tracking-tight truncate max-w-[140px]">{creatorName}</h1>
                    <p className="text-slate-400 text-xs font-medium">CVPA Profile</p>
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
                <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#161e2e] transition-colors group text-slate-400 hover:text-white"
                >
                    <Settings className="h-5 w-5 group-hover:rotate-90 transition-transform duration-500" />
                    <p className="text-sm font-medium">Settings & Profile</p>
                </Link>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors group text-slate-400 hover:text-red-400 mt-1"
                >
                    <LogOut className="h-5 w-5" />
                    <p className="text-sm font-medium">Sign Out</p>
                </button>
            </div>
        </aside>
    )
}
