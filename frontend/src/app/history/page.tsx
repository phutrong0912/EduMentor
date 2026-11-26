"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Clock,
  Sparkles,
  Trash2,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import { createDemoSession, deleteSession, listSessions } from "@/lib/api";
import type { SessionSummary } from "@/types";

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [topicFilter, setTopicFilter] = useState<string>("ALL");
  const [creatingDemo, setCreatingDemo] = useState(false);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await listSessions(50);
      setSessions(data);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const filtered = useMemo(() => {
    if (topicFilter === "ALL") return sessions;
    return sessions.filter((s) => s.topic === topicFilter);
  }, [sessions, topicFilter]);

  const trendData = useMemo(() => {
    return [...filtered]
      .filter((s) => s.overall_score !== null)
      .reverse()
      .map((s, idx) => ({
        name: `#${idx + 1} (${s.topic.split(" ")[0]})`,
        overall: Math.round(s.overall_score ?? 0),
        eyeContact: Math.round(s.avg_eye_contact_rate),
        wpm: Math.round(s.avg_wpm),
      }));
  }, [filtered]);

  const handleCreateDemo = async () => {
    setCreatingDemo(true);
    try {
      const demo = await createDemoSession();
      router.push(`/dashboard/${demo.id}`);
    } catch {
      setCreatingDemo(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Lịch sử & Tiến độ luyện tập
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Theo dõi sự cải thiện điểm số, Eye Contact và tốc độ nói qua từng buổi luyện tập
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={creatingDemo}
            onClick={handleCreateDemo}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-4 py-2.5 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/25 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {creatingDemo ? "Đang tạo báo cáo mẫu..." : "Tạo báo cáo Demo mẫu"}
          </button>

          <Link
            href="/interview"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            + Phiên mới
          </Link>
        </div>
      </div>

      {/* Multi-session Progress Trend Chart */}
      <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">
              Biểu đồ xu hướng tiến bộ
            </h2>
          </div>

          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">Tất cả chủ đề</option>
            <option value="IT Backend">IT Backend</option>
            <option value="IT Frontend">IT Frontend</option>
            <option value="Kinh tế">Kinh tế</option>
            <option value="Thuyết trình tự do">Thuyết trình tự do</option>
          </select>
        </div>

        {trendData.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center text-sm text-slate-400">
            <BarChart3 className="mb-2 h-8 w-8 text-slate-600" />
            Chưa có đủ dữ liệu để vẽ biểu đồ xu hướng. Bạn có thể nhấn &ldquo;Tạo báo cáo Demo mẫu&rdquo; để xem ngay!
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="eyeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "0.75rem",
                    color: "#f8fafc",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="overall"
                  name="Tổng điểm AI"
                  stroke="#818cf8"
                  strokeWidth={2.5}
                  fill="url(#scoreGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="eyeContact"
                  name="Eye Contact (%)"
                  stroke="#34d399"
                  strokeWidth={2}
                  fill="url(#eyeGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Sessions Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Đang tải danh sách phiên...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Chưa có phiên luyện tập nào phù hợp bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">Chủ đề & Chế độ</th>
                  <th className="px-5 py-3.5">Thời gian</th>
                  <th className="px-5 py-3.5">Điểm tổng</th>
                  <th className="px-5 py-3.5">Eye Contact</th>
                  <th className="px-5 py-3.5">WPM / Từ đệm</th>
                  <th className="px-5 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filtered.map((s) => (
                  <tr key={s.id} className="transition hover:bg-slate-800/30">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-white">{s.topic}</p>
                      <p className="text-xs text-slate-400">
                        {s.mode === "interview" ? "Phỏng vấn" : "Thuyết trình"} ·{" "}
                        {s.difficulty ?? "medium"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                        {new Date(s.started_at).toLocaleString("vi-VN")}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-bold text-indigo-300">
                      {s.overall_score !== null
                        ? `${Math.round(s.overall_score)}/100`
                        : "Đang xử lý"}
                    </td>
                    <td className="px-5 py-4 text-emerald-300">
                      {Math.round(s.avg_eye_contact_rate)}%
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-300">
                      {Math.round(s.avg_wpm)} WPM · {s.total_filler_words} từ đệm
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/dashboard/${s.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600/20 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-600/35"
                        >
                          Xem báo cáo
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id)}
                          title="Xóa phiên"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
