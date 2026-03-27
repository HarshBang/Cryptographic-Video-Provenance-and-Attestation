"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
    const router = useRouter();
    const [creatorType, setCreatorType] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const idToken = localStorage.getItem("cognito_id_token");
            if (!idToken) throw new Error("Session expired. Please sign in again.");

            // Store creator_type locally — Cognito federated users can't update
            // custom attributes via SDK, so we store it in localStorage and
            // send it with API calls via the auth token context
            localStorage.setItem("creator_type", creatorType);
            router.replace("/dashboard");
        } catch (e: any) {
            setError(e.message);
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white px-4">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold">One last thing</h1>
                    <p className="text-slate-400 text-sm">Tell us what kind of creator you are so we can set up your profile.</p>
                </div>

                {error && (
                    <div className="text-red-400 text-sm border border-red-500/30 bg-red-500/10 p-3 rounded-lg">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Creator Type</label>
                        <select
                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-slate-300"
                            value={creatorType}
                            onChange={(e) => setCreatorType(e.target.value)}
                            required
                        >
                            <option disabled value="">Select your type</option>
                            <option value="independent">Independent Creator</option>
                            <option value="agency">Agency</option>
                            <option value="brand">Brand</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !creatorType}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-all"
                    >
                        {loading ? "Setting up..." : "Continue to Dashboard"}
                    </button>
                </form>
            </div>
        </div>
    );
}
