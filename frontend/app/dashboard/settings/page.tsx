"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { userPool } from "@/lib/cognito"
import { CognitoUserAttribute } from "amazon-cognito-identity-js"
import { User, Mail, Shield, Save, CheckCircle2, Trash2 } from "lucide-react"

export default function SettingsPage() {
    const router = useRouter()
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [creatorType, setCreatorType] = useState("")
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [message, setMessage] = useState<{ text: string, type: "success" | "error" } | null>(null)

    useEffect(() => {
        const user = userPool.getCurrentUser()
        if (user) {
            user.getSession((err: any, session: any) => {
                if (!err && session.isValid()) {
                    user.getUserAttributes((err: any, attributes: any) => {
                        if (attributes) {
                            attributes.forEach((attr: any) => {
                                if (attr.getName() === "name") setName(attr.getValue())
                                if (attr.getName() === "email") setEmail(attr.getValue())
                                if (attr.getName() === "custom:creator_type") setCreatorType(attr.getValue())
                            })
                        }
                        setLoading(false)
                    })
                } else {
                    router.push("/login")
                }
            })
        } else {
            // Google OAuth user — read from JWT
            const idToken = typeof window !== "undefined" ? localStorage.getItem("cognito_id_token") : null
            if (idToken) {
                try {
                    const payload = JSON.parse(atob(idToken.split(".")[1]))
                    setName(payload.name || "")
                    setEmail(payload.email || "")
                    // Check token first, then localStorage fallback
                    setCreatorType(payload["custom:creator_type"] || localStorage.getItem("creator_type") || "")
                } catch {}
                setLoading(false)
            } else {
                router.push("/login")
            }
        }
    }, [router])

    const handleLogout = () => {
        const user = userPool.getCurrentUser()
        if (user) user.signOut()
        localStorage.removeItem("cognito_id_token")
        localStorage.removeItem("cognito_access_token")
        localStorage.removeItem("cognito_refresh_token")
        router.push('/login')
    }

    const handleDeleteAccount = async () => {
        if (!confirm("Are you sure you want to delete your account? Your signed videos will remain in the system, but you will lose login access.")) return;
        setDeleting(true);
        setMessage(null);
        try {
            const { deleteAccount } = await import("@/lib/api");
            await deleteAccount();
            // Clear session
            const user = userPool.getCurrentUser();
            if (user) user.signOut();
            localStorage.removeItem("cognito_id_token");
            localStorage.removeItem("cognito_access_token");
            localStorage.removeItem("cognito_refresh_token");
            router.push("/login");
        } catch (e: any) {
            setMessage({ text: e.message || "Failed to delete account.", type: "error" });
            setDeleting(false);
        }
    };

    const handleSaveProfile = (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setMessage(null)

        const user = userPool.getCurrentUser()
        if (user) {
            user.getSession((err: any, session: any) => {
                if (!err && session.isValid()) {
                    const attributeList = [
                        new CognitoUserAttribute({ Name: "name", Value: name }),
                    ]
                    user.updateAttributes(attributeList, (err, result) => {
                        setSaving(false)
                        if (err) {
                            setMessage({ text: err.message || "Failed to update profile", type: "error" })
                            return
                        }
                        setMessage({ text: "Profile updated successfully.", type: "success" })
                    })
                }
            })
        } else {
            // Google OAuth users — name is from Google, can't update via Cognito SDK
            setSaving(false)
            setMessage({ text: "Profile name is managed by your Google account.", type: "error" })
        }
    }

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <p className="text-slate-400 animate-pulse">Loading profile...</p>
            </div>
        )
    }

    return (
        <div className="max-w-4xl">
            <header className="mb-8">
                <h2 className="text-white text-3xl font-bold tracking-tight">Settings & Profile</h2>
                <p className="text-vca-text-secondary mt-1">Manage your creator identity and account preferences.</p>
            </header>

            <div className="grid gap-6">
                {/* Profile Card */}
                <div className="bg-vca-surface-dark border border-vca-border-dark rounded-xl overflow-hidden">
                    <div className="border-b border-vca-border-dark p-6 bg-[#192233]">
                        <div className="flex items-center gap-3">
                            <User className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-bold text-white">Public Identity</h3>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">This information is baked into your video manifests.</p>
                    </div>

                    <div className="p-6">
                        {message && (
                            <div className={`p-4 rounded-lg mb-6 flex items-start gap-3 text-sm font-medium ${message.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                                {message.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                                <p>{message.text}</p>
                            </div>
                        )}

                        <form onSubmit={handleSaveProfile} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Creator Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-white placeholder-slate-500"
                                        required
                                    />
                                    <p className="text-xs text-slate-500">Your professional name attached to signed content.</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Email Address</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Mail className="w-4 h-4 text-slate-500" />
                                        </div>
                                        <input
                                            type="email"
                                            value={email}
                                            disabled
                                            className="w-full bg-slate-800/30 border border-slate-700/50 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-400 cursor-not-allowed opacity-75"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500">Email cannot be changed via dashboard.</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Creator Type</label>
                                <input
                                    type="text"
                                    value={creatorType ? creatorType.charAt(0).toUpperCase() + creatorType.slice(1) : "Standard"}
                                    disabled
                                    className="w-full md:w-1/2 bg-slate-800/30 border border-slate-700/50 rounded-lg px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed opacity-75"
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-800 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={saving || !name}
                                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {saving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    <span>{saving ? "Saving..." : "Save Changes"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Security Section */}
                <div className="bg-vca-surface-dark border border-vca-border-dark rounded-xl overflow-hidden">
                    <div className="border-b border-vca-border-dark p-6 bg-[#192233]">
                        <div className="flex items-center gap-3">
                            <Shield className="w-5 h-5 text-slate-400" />
                            <h3 className="text-lg font-bold text-white">Security & Access</h3>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg bg-red-500/5 border border-red-500/10">
                            <div>
                                <h4 className="text-white font-medium">Delete Account</h4>
                                <p className="text-sm text-slate-400 mt-1">Removes your account and login access. Your signed videos and credentials remain in the system.</p>
                            </div>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={deleting}
                                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg text-sm font-bold transition-all whitespace-nowrap disabled:opacity-50"
                            >
                                {deleting ? (
                                    <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                <span>{deleting ? "Deleting..." : "Delete Account"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
