"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CognitoUserAttribute, CognitoUser } from "amazon-cognito-identity-js";
import { userPool } from "@/lib/cognito";
import ShapeGrid from "@/components/ui/ShapeGrid";

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

    const handleGoogleLogin = () => {
        const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
        const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
        const redirectUri = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : "";
        
        if (!domain) {
            setError("Cognito domain is not configured. Please set NEXT_PUBLIC_COGNITO_DOMAIN in .env.local");
            return;
        }
        
        const url = `https://${domain}/oauth2/authorize?identity_provider=Google&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=CODE&client_id=${clientId}&scope=email+openid+profile`;
        window.location.href = url;
    };

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
        <div className="flex min-h-screen w-full overflow-hidden text-slate-100 bg-slate-900">
            <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 w-full">
                
                {/* Left Side: Visual/Hero */}
                <div className="hidden lg:flex flex-col items-center justify-center gap-12 p-12 bg-[#101622] relative overflow-hidden border-r border-slate-800">
                    <div className="absolute inset-0 z-0">
                        <ShapeGrid 
                            speed={0.5}
                            squareSize={60}
                            direction="diagonal"
                            borderColor="#271E37"
                            hoverFillColor="#222222"
                            shape="square"
                            hoverTrailAmount={0}
                        />
                    </div>
                    <div className="relative z-10 pointer-events-none text-center w-full px-4">
                        <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight">Focus on your art.<br/>We'll protect its authenticity.</h2>
                    </div>
                    <div className="relative z-10 space-y-6 pointer-events-none w-full max-w-md">
                        <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-center">
                            <p className="font-bold text-blue-500 text-lg mb-2">Effortless Workflow</p>
                            <p className="opacity-80 text-white text-sm">Sign content right from your browser or dashboard.</p>
                        </div>
                        <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-center">
                            <p className="font-bold text-blue-500 text-lg mb-2">Unbreakable Proof</p>
                            <p className="opacity-80 text-white text-sm">Permanent cryptographic ownership of your work.</p>
                        </div>
                    </div>
                </div>

                {/* Right Side: Auth Forms */}
                <div className="flex flex-col justify-center items-center p-8 lg:p-16 bg-slate-900 overflow-y-auto">
                    <div className="w-full max-w-md flex flex-col pt-8 pb-12">
                        {step === "verify" && (
                            <div className="mb-8 text-center">
                                <h2 className="text-2xl font-bold text-white">Verify Email</h2>
                                <p className="text-slate-400 mt-2">We sent a code to {email}</p>
                            </div>
                        )}

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

                        {/* Divider */}
                        {step === "register" && (
                            <>
                                <div className="relative my-8">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-slate-800"></div>
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-slate-900 px-2 text-slate-400">Or continue with</span>
                                    </div>
                                </div>

                                {/* Google Auth Button */}
                                <button 
                                    onClick={handleGoogleLogin}
                                    type="button"
                                    className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-bold py-3 px-4 rounded-lg transition-all shadow-sm border border-slate-200"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                    Sign up with Google
                                </button>
                            </>
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
}
