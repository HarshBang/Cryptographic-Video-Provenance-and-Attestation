"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import ShapeGrid from "@/components/ui/ShapeGrid";

export default function Home() {
  return (
    <>
      <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#101622] text-white p-6 overflow-hidden">
        
        {/* Background Grid */}
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

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center max-w-2xl text-center space-y-8">
          
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="w-14 h-14 text-[#135bec]" />
            <h1 className="text-5xl font-bold tracking-tighter">CVPA System</h1>
          </div>

          <div className="space-y-4">
            <h2 className="text-3xl font-semibold text-white">
              Protect Your Content. Verify Your Identity.
            </h2>
          </div>

          <div className="flex flex-col gap-4 w-full max-w-md pt-4">
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 bg-[#135bec] hover:bg-[#135bec]/90 text-white font-bold h-14 rounded-xl transition-all w-full text-lg shadow-lg hover:shadow-[#135bec]/25"
            >
              Get Started as a Creator <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/verify"
              className="flex items-center justify-center gap-2 bg-[#161e2e]/80 backdrop-blur-sm border border-[#2a3649] hover:bg-[#1f2937] text-white font-medium h-14 rounded-xl transition-all w-full text-lg"
            >
              Verify a Video Link
            </Link>
          </div>

          <footer className="mt-16 text-sm text-[#64748b] flex flex-col items-center gap-2">
            <span>Developed by Harsh Bang</span>
            <a href="https://github.com/HarshBang/Cryptographic-Video-Provenance-and-Attestation" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline font-medium">
              View GitHub Repository
            </a>
          </footer>
        </div>
      </div>
    </>
  );
}
