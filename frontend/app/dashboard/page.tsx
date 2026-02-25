import { Verified, MailCheck, TrendingUp, CheckCircle, Copy, Download, Play } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
    return (
        <>
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-col gap-1">
                    <h2 className="text-white text-3xl md:text-4xl font-bold tracking-tight">Welcome back, Alex</h2>
                    <p className="text-vca-text-secondary text-base font-normal">Manage your signed videos and verification requests.</p>
                </div>
                <Link href="/dashboard/intake">
                    <button className="flex items-center justify-center gap-2 rounded-lg h-12 px-6 bg-primary hover:bg-primary/90 text-white text-sm font-bold tracking-wide transition-all shadow-lg shadow-primary/20 hover:translate-y-[-2px]">
                        <Play className="fill-current w-4 h-4" />
                        <span>Sign New Video</span>
                    </button>
                </Link>
            </header>

            {/* Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* Stat Card 1 */}
                <div className="relative overflow-hidden rounded-xl p-6 bg-vca-surface-dark border border-vca-border-dark flex flex-col justify-between gap-4 group hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Verified className="w-16 h-16 text-white" />
                    </div>
                    <div>
                        <p className="text-vca-text-secondary text-sm font-medium uppercase tracking-wider">Total Signed Videos</p>
                        <p className="text-white text-4xl font-bold mt-1">142</p>
                    </div>
                    <div className="flex items-center gap-2 text-vca-success">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm font-medium">+12% this week</span>
                    </div>
                </div>

                {/* Stat Card 2 */}
                <div className="relative overflow-hidden rounded-xl p-6 bg-vca-surface-dark border border-vca-border-dark flex flex-col justify-between gap-4 group hover:border-primary/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <MailCheck className="w-16 h-16 text-white" />
                    </div>
                    <div>
                        <p className="text-vca-text-secondary text-sm font-medium uppercase tracking-wider">Verification Requests</p>
                        <p className="text-white text-4xl font-bold mt-1">28</p>
                    </div>
                    <div className="flex items-center gap-2 text-primary">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">All Valid</span>
                    </div>
                </div>
            </div>

            {/* Recent Activity Table */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-white text-xl font-bold">Recent Videos</h3>
                    <button className="text-primary hover:text-white text-sm font-medium transition-colors">View All</button>
                </div>
                <div className="rounded-xl border border-vca-border-dark bg-vca-surface-dark overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px]">
                            <thead className="bg-[#192233] border-b border-vca-border-dark">
                                <tr>
                                    <th className="px-6 py-4 text-left text-vca-text-secondary text-xs font-semibold uppercase tracking-wider w-16">Preview</th>
                                    <th className="px-6 py-4 text-left text-vca-text-secondary text-xs font-semibold uppercase tracking-wider">Video Title</th>
                                    <th className="px-6 py-4 text-left text-vca-text-secondary text-xs font-semibold uppercase tracking-wider">Date Signed</th>
                                    <th className="px-6 py-4 text-left text-vca-text-secondary text-xs font-semibold uppercase tracking-wider">Credential ID</th>
                                    <th className="px-6 py-4 text-left text-vca-text-secondary text-xs font-semibold uppercase tracking-wider">Integrity Status</th>
                                    <th className="px-6 py-4 text-right text-vca-text-secondary text-xs font-semibold uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-vca-border-dark">
                                {/* Row 1 */}
                                <tr className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="h-10 w-16 rounded overflow-hidden bg-slate-800 relative">
                                            <div className="absolute inset-0 bg-cover bg-center opacity-80 bg-gradient-to-r from-blue-900 to-slate-900" />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-white font-medium text-sm">Vlog_Mount_Everest_Final.mp4</span>
                                            <span className="text-xs text-slate-500">2.4 GB • 4K HEVC</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-slate-300 text-sm">Oct 24, 2023</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <code className="text-xs text-primary bg-primary/10 px-2 py-1 rounded font-mono">0x7a...9f2</code>
                                            <button className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-white">
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-vca-success/10 px-2.5 py-1 text-xs font-medium text-vca-success border border-vca-success/20">
                                            <Verified className="w-3.5 h-3.5" />
                                            Intact
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-slate-400 hover:text-primary transition-colors p-2 rounded hover:bg-primary/10" title="Download Evidence Pack">
                                            <Download className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    )
}
