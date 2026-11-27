"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  Trash2,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import { deleteSession, listSessions } from "@/lib/api";
import type { SessionSummary } from "@/types";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [topicFilter, setTopicFilter] = useState<string>("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const data = await listSessions(50);
      setSessions(data);
    } catch (err) {
      setSessions([]);
      setErrorBanner(
        err instanceof Error
          ? err.message
          : "Không thể tải danh sách phiên luyện tập."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    const onAuthChange = () => {
      loadSessions();
    };
    window.addEventListener("edumentor-auth-change", onAuthChange);
    return () => window.removeEventListener("edumentor-auth-change", onAuthChange);
  }, [loadSessions]);

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

  const handleDelete = async (session: SessionSummary) => {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa phiên "${session.topic}" (${new Date(
        session.started_at
      ).toLocaleString("vi-VN")})? Hành động này không thể hoàn tác.`
    );
    if (!confirmed) return;

    setDeletingId(session.id);
    setErrorBanner(null);
    try {
      await deleteSession(session.id);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Không thể xóa phiên này."
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Lịch sử & Tiến độ luyện tập
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi sự cải thiện điểm số, Eye Contact và tốc độ nói qua từng buổi luyện tập
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/interview"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            + Bắt đầu phiên mới
          </Link>
        </div>
      </div>

      {errorBanner && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorBanner}
        </div>
      )}

      {/* Multi-session Progress Trend Chart */}
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">
              Biểu đồ xu hướng tiến bộ
            </h2>
          </div>

          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none"
          >
            <option value="ALL">Tất cả chủ đề</option>
            <option value="IT Backend">IT Backend</option>
            <option value="IT Frontend">IT Frontend</option>
            <option value="Kinh tế">Kinh tế</option>
            <option value="Thuyết trình tự do">Thuyết trình tự do</option>
          </select>
        </div>

        {trendData.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center gap-3 text-center text-sm text-slate-500">
            <BarChart3 className="h-8 w-8 text-slate-400" />
            <p>
              Chưa có dữ liệu tiến bộ. Hãy hoàn thành ít nhất một phiên luyện tập để theo dõi biểu đồ xu hướng của bạn.
            </p>
            <Link
              href="/interview"
              className="rounded-lg bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              Vào phòng luyện tập ngay
            </Link>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="eyeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderColor: "#e2e8f0",
                    borderRadius: "0.75rem",
                    color: "#0f172a",
                    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="overall"
                  name="Tổng điểm AI"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  fill="url(#scoreGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="eyeContact"
                  name="Eye Contact (%)"
                  stroke="#059669"
                  strokeWidth={2}
                  fill="url(#eyeGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Sessions Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Đang tải danh sách phiên...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Chưa có phiên luyện tập nào phù hợp bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Chủ đề & Chế độ</th>
                  <th className="px-5 py-3.5">Thời gian</th>
                  <th className="px-5 py-3.5">Điểm tổng</th>
                  <th className="px-5 py-3.5">Eye Contact</th>
                  <th className="px-5 py-3.5">WPM / Từ đệm</th>
                  <th className="px-5 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {filtered.map((s) => (
                  <tr key={s.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{s.topic}</p>
                      <p className="text-xs text-slate-500">
                        {s.mode === "interview" ? "Phỏng vấn" : "Thuyết trình"} ·{" "}
                        {s.difficulty ?? "medium"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {new Date(s.started_at).toLocaleString("vi-VN")}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-bold text-indigo-600">
                      {s.overall_score !== null
                        ? `${Math.round(s.overall_score)}/100`
                        : "Đang xử lý"}
                    </td>
                    <td className="px-5 py-4 font-medium text-emerald-600">
                      {Math.round(s.avg_eye_contact_rate)}%
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      {Math.round(s.avg_wpm)} WPM · {s.total_filler_words} từ đệm
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/dashboard/${s.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                        >
                          Xem báo cáo
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          disabled={deletingId === s.id}
                          onClick={() => handleDelete(s)}
                          title="Xóa phiên"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
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
