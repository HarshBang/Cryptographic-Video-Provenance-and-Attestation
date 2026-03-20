"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CognitoUserAttribute, CognitoUser } from "amazon-cognito-identity-js";
import { userPool } from "@/lib/cognito";

export default function RegisterPage() {
    // Top-Level State
    const [step, setStep] = useState<"register" | "verify">("register");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const router = useRouter();

    // Registration Form State
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [creatorType, setCreatorType] = useState("");

    // Verification Form State
    const [code, setCode] = useState("");

    const handleRegister = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        const attributeList = [
            new CognitoUserAttribute({ Name: 'email', Value: email }),
            new CognitoUserAttribute({ Name: 'name', Value: fullName }),
            new CognitoUserAttribute({ Name: 'custom:creator_type', Value: creatorType }),
        ];

        userPool.signUp(email, password, attributeList, [], (err, result) => {
            setLoading(false);
            if (err) {
                console.error("Signup error:", err);
                setError(err.message || "Failed to register");
                return;
            }
            setSuccessMessage("Registration successful! Please check your email for the verification code.");
            setStep("verify");
        });
    };

    const handleVerify = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const cognitoUser = new CognitoUser({
            Username: email,
            Pool: userPool,
        });

        cognitoUser.confirmRegistration(code, true, (err, result) => {
            setLoading(false);
            if (err) {
                console.error("Verification error:", err);
                setError(err.message || "Failed to verify account");
                return;
            }
            setSuccessMessage("Account successfully verified! Redirecting to login...");
            setTimeout(() => {
                router.push("/login");
            }, 3000);
        });
    };

    const resendCode = () => {
        setError(null);
        setSuccessMessage(null);
        const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
        cognitoUser.resendConfirmationCode((err, result) => {
            if (err) {
                setError(err.message || "Failed to resend code");
                return;
            }
            setSuccessMessage("Verification code resent to your email.");
        });
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-slate-900 bg-mesh overflow-x-hidden text-slate-100">
            {/* Header / Logo Area */}
            <header className="flex items-center justify-between px-6 py-6 lg:px-12">
                <div className="flex items-center gap-3">
                    <div className="size-8 bg-blue-600 flex items-center justify-center rounded-lg shadow-lg shadow-blue-600/20">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 4H17.3334V17.3334H30.6666V30.6666H44V44H4V4Z" fill="currentColor"></path>
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold tracking-tight text-white">Provenance AI</h1>
                </div>
            </header>

            {/* Main Content Section */}
            <main className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 bg-slate-900/50 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
                    
                    {/* Left Side: Visual/Hero */}
                    <div className="hidden lg:flex flex-col justify-between p-12 bg-blue-600 relative overflow-hidden">
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
                            <h2 className="text-4xl font-bold text-white leading-tight">Empowering creators through verifiable video provenance.</h2>
                            <p className="mt-6 text-blue-100/80 text-lg">Secure your digital legacy with blockchain-backed authenticity seals and cryptographic watermarking.</p>
                        </div>
                    </div>

                    {/* Right Side: Auth Forms */}
                    <div className="p-8 lg:p-12 flex flex-col bg-slate-900">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-white">{step === "register" ? "Get Started" : "Verify Email"}</h2>
                            <p className="text-slate-400 mt-2">
                                {step === "register" ? "Welcome back to the future of content security." : `We sent a code to ${email}`}
                            </p>
                        </div>

                        {/* Form Tabs (Only show on register step) */}
                        {step === "register" && (
                            <div className="flex border-b border-slate-800 mb-8">
                                <Link href="/login" className="flex-1 text-center py-3 text-sm font-bold border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition-all">Sign In</Link>
                                <Link href="/register" className="flex-1 text-center py-3 text-sm font-bold border-b-2 border-blue-600 text-blue-500 transition-all">Create Account</Link>
                            </div>
                        )}

                        {error && <div className="mb-4 text-red-500 text-sm border border-red-500/50 bg-red-500/10 p-3 rounded">{error}</div>}
                        {successMessage && <div className="mb-4 text-green-500 text-sm border border-green-500/50 bg-green-500/10 p-3 rounded">{successMessage}</div>}

                        {/* STEP 1: REGISTRATION FORM */}
                        {step === "register" && (
                            <form className="space-y-4" onSubmit={handleRegister}>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Full Name</label>
                                    <input 
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder-slate-500" 
                                        placeholder="John Doe" 
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Email Address</label>
                                    <input 
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder-slate-500" 
                                        placeholder="name@company.com" 
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Creator Type</label>
                                    <select 
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all appearance-none text-slate-300"
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
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Password</label>
                                    <input 
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder-slate-500" 
                                        placeholder="••••••••" 
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={8}
                                    />
                                </div>
                                <div className="flex items-start gap-3 pt-2">
                                    <div className="flex items-center h-5">
                                        <input className="w-4 h-4 text-blue-600 bg-slate-900 border-slate-700 rounded focus:ring-blue-500/50" id="terms" type="checkbox" required />
                                    </div>
                                    <label className="text-xs text-slate-400 leading-tight" htmlFor="terms">
                                        I agree to the <Link className="text-blue-500 hover:underline" href="#">Terms of Service</Link> and <Link className="text-blue-500 hover:underline" href="#">Privacy Policy</Link>.
                                    </label>
                                </div>
                                <button 
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 mt-2 rounded-lg shadow-lg shadow-blue-600/20 transition-all transform active:scale-[0.98]" 
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading ? "Creating Account..." : "Create Account"}
                                </button>
                            </form>
                        )}

                        {/* STEP 2: VERIFICATION FORM */}
                        {step === "verify" && (
                            <form className="space-y-4" onSubmit={handleVerify}>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Verification Code</label>
                                    <input 
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder-slate-500 tracking-[0.5em] text-center" 
                                        placeholder="123456" 
                                        type="text"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        required
                                        maxLength={6}
                                        autoFocus
                                    />
                                </div>
                                <button 
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 mt-4 rounded-lg shadow-lg shadow-blue-600/20 transition-all transform active:scale-[0.98]" 
                                    type="submit"
                                    disabled={loading || code.length < 6}
                                >
                                    {loading ? "Verifying..." : "Verify Account"}
                                </button>
                                <div className="text-center mt-4">
                                    <button 
                                        type="button" 
                                        onClick={resendCode}
                                        className="text-sm text-blue-500 hover:text-blue-400 font-medium"
                                    >
                                        Resend Code
                                    </button>
                                </div>
                            </form>
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
}
