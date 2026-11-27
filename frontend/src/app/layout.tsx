import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduMentor AI — Multimodal Interview & Presentation Coach",
  description:
    "Hệ thống đánh giá và hỗ trợ luyện kỹ năng phỏng vấn, thuyết trình đa phương thức ứng dụng Computer Vision, Speech-to-Text và LLM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
