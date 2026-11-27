"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BrainCircuit,
  Video,
  BarChart3,
  History,
  UserCircle2,
  LogOut,
} from "lucide-react";
import { clearAuthSession, getAuthToken, getCurrentUser } from "@/lib/api";
import type { AuthUser } from "@/types";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
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

    // Verify stored token against backend on initial mount
    if (getAuthToken()) {
      getCurrentUser()
        .then((verified) => {
          setUser(verified);
          localStorage.setItem("edumentor_user", JSON.stringify(verified));
        })
        .catch(() => {
          setUser(null);
        });
    }

    window.addEventListener("edumentor-auth-change", sync);
    return () => window.removeEventListener("edumentor-auth-change", sync);
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    setUser(null);
    router.replace("/auth");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={user ? "/" : "/auth"} className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/20">
            <BrainCircuit className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            EduMentor <span className="text-indigo-600">AI</span>
          </span>
        </Link>

        {user ? (
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/"
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname === "/"
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              Trang chủ
            </Link>

            <Link
              href="/history"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname.startsWith("/history")
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
                  : "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700"
              }`}
            >
              <Video className="h-4 w-4" />
              Phòng luyện tập
            </Link>

            {pathname.startsWith("/dashboard") && (
              <span className="hidden items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 md:flex">
                <BarChart3 className="h-4 w-4" />
                Báo cáo
              </span>
            )}

            <div className="ml-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
              <UserCircle2 className="h-4 w-4 text-indigo-600" />
              <span className="hidden max-w-[100px] truncate font-medium sm:inline">
                {user.full_name}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                title="Đăng xuất"
                className="text-slate-400 hover:text-rose-600"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </nav>
        ) : (
          <span className="text-xs font-medium text-slate-500">
            Đăng nhập để sử dụng hệ thống
          </span>
        )}
      </div>
    </header>
  );
}
