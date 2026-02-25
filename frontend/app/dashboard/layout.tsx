"use client"

import { Sidebar } from "@/components/Sidebar"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-screen w-full overflow-hidden bg-vca-bg-dark">
            <Sidebar />
            <main className="flex-1 flex flex-col h-full overflow-hidden relative ml-64 transition-all duration-300">
                <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                    <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    )
}
