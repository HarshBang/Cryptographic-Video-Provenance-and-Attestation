"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function CallbackHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const code = searchParams.get("code");
        const errorParam = searchParams.get("error");

        if (errorParam) {
            setError(`Authentication error: ${errorParam}`);
            return;
        }

        if (!code) {
            setError("No authorization code received.");
            return;
        }

        exchangeCodeForTokens(code);
    }, [searchParams]);

    const exchangeCodeForTokens = async (code: string) => {
        const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
        const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
        const redirectUri = `${window.location.origin}/auth/callback`;

        try {
            const res = await fetch(`https://${domain}/oauth2/token`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    client_id: clientId!,
                    code,
                    redirect_uri: redirectUri,
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Token exchange failed: ${text}`);
            }

            const tokens = await res.json();

            // Store tokens so the rest of the app can use them
            localStorage.setItem("cognito_id_token", tokens.id_token);
            localStorage.setItem("cognito_access_token", tokens.access_token);
            if (tokens.refresh_token) {
                localStorage.setItem("cognito_refresh_token", tokens.refresh_token);
            }

            // Check if first-time Google user (no creator_type set yet)
            const creatorType = localStorage.getItem("creator_type");
            if (!creatorType) {
                // Try to read from token in case it was set previously
                try {
                    const payload = JSON.parse(atob(tokens.id_token.split(".")[1]));
                    if (!payload["custom:creator_type"]) {
                        router.replace("/auth/onboarding");
                        return;
                    }
                } catch {}
            }

            router.replace("/dashboard");
        } catch (e: any) {
            setError(e.message || "Failed to complete sign-in.");
        }
    };

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
                <div className="text-center space-y-4 max-w-md p-8">
                    <p className="text-red-400 text-sm border border-red-500/30 bg-red-500/10 p-4 rounded-lg">{error}</p>
                    <button
                        onClick={() => router.replace("/login")}
                        className="text-blue-400 hover:underline text-sm"
                    >
                        Back to Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
            <div className="text-center space-y-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-slate-400 text-sm">Completing sign-in...</p>
            </div>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <CallbackHandler />
        </Suspense>
    );
}
