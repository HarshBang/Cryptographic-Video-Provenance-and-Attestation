"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthenticationDetails, CognitoUser } from "amazon-cognito-identity-js";
import { userPool } from "@/lib/cognito";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const authenticationDetails = new AuthenticationDetails({
            Username: email,
            Password: password,
        });

        const cognitoUser = new CognitoUser({
            Username: email,
            Pool: userPool,
        });

        cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: (result) => {
                console.log("Login success!", result);
                router.push("/dashboard");
            },
            onFailure: (err) => {
                console.error("Login failed:", err);
                setError(err.message || "Failed to log in");
                setLoading(false);
            },
        });
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-slate-900 bg-mesh overflow-x-hidden text-slate-100">


            {/* Main Content Section */}
            <main className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 bg-slate-900/50 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
                    
                    {/* Left Side: Visual/Hero */}
                    <div className="hidden lg:flex flex-col justify-center gap-16 p-12 bg-blue-600 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-20">
                            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                                <defs>
                                    <pattern height="10" id="grid" patternUnits="userSpaceOnUse" width="10">
                                        <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"></path>
                                    </pattern>
                                </defs>
                                <rect fill="url(#grid)" height="100" width="100"></rect>
                            </svg>
                        </div>
                        <div className="relative z-10">
                            <h2 className="text-3xl font-bold text-white leading-tight">Focus on your art. We'll protect its authenticity.</h2>
                            <p className="mt-4 text-blue-100/80 text-lg">Seamlessly seal your original work against deepfakes and unauthorized manipulation with zero friction.</p>
                        </div>
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center gap-4 bg-white/10 p-4 rounded-lg backdrop-blur-sm border border-white/10">
                                <span className="material-symbols-outlined text-white opacity-80">video_camera_front</span>
                                <div className="text-sm text-white">
                                    <p className="font-bold">Effortless Workflow</p>
                                    <p className="opacity-70">Sign your content directly from your browser extension or studio dashboard.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 bg-white/10 p-4 rounded-lg backdrop-blur-sm border border-white/10">
                                <span className="material-symbols-outlined text-white opacity-80">gpp_good</span>
                                <div className="text-sm text-white">
                                    <p className="font-bold">Unbreakable Proof</p>
                                    <p className="opacity-70">Establish permanent cryptographic ownership over every frame.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Auth Forms */}
                    <div className="p-8 lg:p-16 flex flex-col bg-slate-900">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-white">Welcome to CVPA</h2>
                            <p className="text-slate-400 mt-2">Sign in to manage your protected video portfolio.</p>
                        </div>

                        {/* Form Tabs */}
                        <div className="flex border-b border-slate-800 mb-8">
                            <Link href="/login" className="flex-1 text-center py-3 text-sm font-bold border-b-2 border-blue-600 text-blue-500 transition-all">Sign In</Link>
                            <Link href="/register" className="flex-1 text-center py-3 text-sm font-bold border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition-all">Create Account</Link>
                        </div>

                        {error && <div className="mb-4 text-red-500 text-sm">{error}</div>}

                        {/* Form Section */}
                        <form className="space-y-5" onSubmit={handleLogin}>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Email Address</label>
                                <input 
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder-slate-500" 
                                    placeholder="name@company.com" 
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-medium text-slate-300">Password</label>
                                    <Link className="text-xs font-medium text-blue-500 hover:underline" href="#">Forgot password?</Link>
                                </div>
                                <input 
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder-slate-500" 
                                    placeholder="••••••••" 
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <button 
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-600/20 transition-all transform active:scale-[0.98]" 
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? "Signing In..." : "Sign In"}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className="relative my-8">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-800"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-slate-900 px-2 text-slate-400">Or continue with</span>
                            </div>
                        </div>

                        {/* Footer Note */}
                        <p className="mt-auto text-center text-xs text-slate-400">
                            By signing in, you agree to our <Link className="text-blue-500 hover:underline" href="#">Terms of Service</Link> and <Link className="text-blue-500 hover:underline" href="#">Privacy Policy</Link>.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
