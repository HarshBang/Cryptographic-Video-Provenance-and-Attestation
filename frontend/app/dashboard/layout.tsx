"use client"

import { Sidebar } from "@/components/Sidebar";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { userPool } from "@/lib/cognito";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter();
    const [authChecked, setAuthChecked] = useState(false);

    useEffect(() => {
        const user = userPool.getCurrentUser();
        // Check for valid (non-expired) OAuth token
        let hasValidOAuthToken = false;
        if (typeof window !== "undefined") {
            const oauthToken = localStorage.getItem("cognito_id_token");
            if (oauthToken) {
                try {
                    const payload = JSON.parse(atob(oauthToken.split(".")[1]));
                    hasValidOAuthToken = payload.exp && Date.now() / 1000 < payload.exp;
                } catch {}
                if (!hasValidOAuthToken) {
                    localStorage.removeItem("cognito_id_token");
                    localStorage.removeItem("cognito_access_token");
                    localStorage.removeItem("cognito_refresh_token");
                }
            }
        }
        if (!user && !hasValidOAuthToken) {
            router.push("/login");
        } else {
            setAuthChecked(true);
        }
    }, [router]);

    if (!authChecked) {
        return <div className="flex h-screen w-full items-center justify-center bg-vca-bg-dark text-white">Loading...</div>;
    }

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
