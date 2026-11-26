"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, LogIn, UserPlus } from "lucide-react";
import { loginUser, registerUser } from "@/lib/api";

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const resp =
        tab === "login"
          ? await loginUser({ email, password })
          : await registerUser({ email, full_name: fullName, password });

      localStorage.setItem("edumentor_token", resp.access_token);
      localStorage.setItem("edumentor_user", JSON.stringify(resp.user));
      window.dispatchEvent(new Event("edumentor-auth-change"));
      router.push("/interview");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Đăng nhập/Đăng ký thất bại."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-md items-center justify-center px-4 py-12">
      <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-7 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600">
            <BrainCircuit className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">
            {tab === "login" ? "Đăng nhập EduMentor AI" : "Tạo tài khoản mới"}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Lưu trữ lịch sử phỏng vấn và theo dõi tiến bộ của riêng bạn
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-950 p-1 text-sm">
          <button
            type="button"
            onClick={() => setTab("login")}
            className={`rounded-lg py-2 font-medium transition ${
              tab === "login"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => setTab("register")}
            className={`rounded-lg py-2 font-medium transition ${
              tab === "register"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Đăng ký
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-950/50 px-3.5 py-2.5 text-xs text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === "register" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Họ và tên
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@university.edu.vn"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Mật khẩu
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {tab === "login" ? (
              <>
                <LogIn className="h-4 w-4" />
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                {loading ? "Đang tạo tài khoản..." : "Đăng ký"}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
