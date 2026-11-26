"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BrainCircuit,
  Video,
  BarChart3,
  History,
  UserCircle2,
  LogOut,
} from "lucide-react";
import type { AuthUser } from "@/types";

export function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const sync = () => {
      try {
        const raw = localStorage.getItem("edumentor_user");
        setUser(raw ? (JSON.parse(raw) as AuthUser) : null);
      } catch {
        setUser(null);
      }
    };
    sync();
    window.addEventListener("edumentor-auth-change", sync);
    return () => window.removeEventListener("edumentor-auth-change", sync);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("edumentor_token");
    localStorage.removeItem("edumentor_user");
    setUser(null);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
            <BrainCircuit className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            EduMentor <span className="text-indigo-400">AI</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              pathname === "/"
                ? "bg-slate-800 text-white"
                : "text-slate-300 hover:bg-slate-900 hover:text-white"
            }`}
          >
            Trang chủ
          </Link>

          <Link
            href="/history"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              pathname.startsWith("/history")
                ? "bg-slate-800 text-white"
                : "text-slate-300 hover:bg-slate-900 hover:text-white"
            }`}
          >
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Tiến độ</span>
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
            <span className="hidden items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-300 md:flex">
              <BarChart3 className="h-4 w-4" />
              Báo cáo
            </span>
          )}

          {user ? (
            <div className="ml-1 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200">
              <UserCircle2 className="h-4 w-4 text-indigo-400" />
              <span className="hidden max-w-[100px] truncate sm:inline">
                {user.full_name}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                title="Đăng xuất"
                className="text-slate-400 hover:text-rose-400"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/auth"
              className="ml-1 flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-700 hover:text-white"
            >
              <UserCircle2 className="h-4 w-4" />
              <span className="hidden sm:inline">Đăng nhập</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
