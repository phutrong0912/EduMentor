"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { CriteriaScores } from "@/types";

interface RadarScoreChartProps {
  scores: CriteriaScores;
}

export function RadarScoreChart({ scores }: RadarScoreChartProps) {
  const data = [
    { axis: "Nội dung", score: Math.round(scores.content), fullMark: 100 },
    { axis: "Ngữ điệu & Tốc độ", score: Math.round(scores.tone_pace), fullMark: 100 },
    { axis: "Tác phong & Biểu cảm", score: Math.round(scores.posture_expression), fullMark: 100 },
    { axis: "Tương tác mắt", score: Math.round(scores.eye_contact), fullMark: 100 },
  ];

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: "#334155", fontSize: 12, fontWeight: 600 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fill: "#64748b", fontSize: 10 }}
          />
          <Radar
            name="Điểm số"
            dataKey="score"
            stroke="#4f46e5"
            fill="#6366f1"
            fillOpacity={0.28}
            strokeWidth={2.5}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              borderColor: "#e2e8f0",
              borderRadius: "0.75rem",
              color: "#0f172a",
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
            }}
            formatter={(value: number) => [`${value} / 100`, "Điểm"]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
