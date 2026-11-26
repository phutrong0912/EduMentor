"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrainCircuit, Video, BarChart3 } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
            <BrainCircuit className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">
              EduMentor <span className="text-indigo-400">AI</span>
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              pathname === "/"
                ? "bg-slate-800 text-white"
                : "text-slate-300 hover:bg-slate-900 hover:text-white"
            }`}
          >
            Trang chủ
          </Link>
          <Link
            href="/interview"
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              pathname.startsWith("/interview")
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                : "bg-indigo-600/90 text-white hover:bg-indigo-500"
            }`}
          >
            <Video className="h-4 w-4" />
            Phòng luyện tập
          </Link>
          {pathname.startsWith("/dashboard") && (
            <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-300">
              <BarChart3 className="h-4 w-4" />
              Báo cáo
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
