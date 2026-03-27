import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#101622] text-white p-6">
      <div className="flex items-center gap-3 mb-8">
        <ShieldCheck className="w-12 h-12 text-[#135bec]" />
        <h1 className="text-4xl font-bold tracking-tighter">CVPA System</h1>
      </div>

      <div className="max-w-md text-center space-y-6">
        <p className="text-[#92a4c9] text-lg">
          The Creator-Friendly Video Signing & Provenance Verification System.
        </p>

        <div className="flex flex-col gap-4 w-full">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 bg-[#135bec] hover:bg-[#135bec]/90 text-white font-bold h-12 rounded-lg transition-all w-full"
          >
            Go to Creator Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/verify"
            className="flex items-center justify-center gap-2 bg-[#161e2e] hover:bg-[#1f2937] text-white border border-[#2a3649] font-medium h-12 rounded-lg transition-all w-full"
          >
            Public Verification Page
          </Link>
        </div>
      </div>

      <footer className="mt-20 text-[11px] text-[#64748b] flex flex-col items-center gap-1.5">
        <span>Developed by Harsh Bang</span>
        <a href="https://github.com/HarshBang/Cryptographic-Video-Provenance-and-Attestation" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline font-medium">
          View GitHub Repository
        </a>
      </footer>
    </div>
  );
}
