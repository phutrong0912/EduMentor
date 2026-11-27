"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { clearAuthSession, getAuthToken, getCurrentUser } from "@/lib/api";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute = pathname.startsWith("/auth");

  const [status, setStatus] = useState<"checking" | "allowed" | "redirecting">(
    "checking"
  );

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      const token = getAuthToken();

      if (!token) {
        if (isAuthRoute) {
          if (!cancelled) setStatus("allowed");
        } else {
          if (!cancelled) setStatus("redirecting");
          router.replace("/auth");
        }
        return;
      }

      try {
        const user = await getCurrentUser();
        if (cancelled) return;
        localStorage.setItem("edumentor_user", JSON.stringify(user));
        if (isAuthRoute) {
          setStatus("redirecting");
          router.replace("/");
        } else {
          setStatus("allowed");
        }
      } catch {
        if (cancelled) return;
        clearAuthSession();
        if (isAuthRoute) {
          setStatus("allowed");
        } else {
          setStatus("redirecting");
          router.replace("/auth");
        }
      }
    };

    verify();

    const onAuthChange = () => {
      const token = getAuthToken();
      if (!token && !isAuthRoute) {
        setStatus("redirecting");
        router.replace("/auth");
      } else if (token && !isAuthRoute) {
        setStatus("allowed");
      }
    };

    window.addEventListener("edumentor-auth-change", onAuthChange);
    return () => {
      cancelled = true;
      window.removeEventListener("edumentor-auth-change", onAuthChange);
    };
  }, [isAuthRoute, router]);

  if (status !== "allowed") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-indigo-600" />
          <p className="mt-3 text-sm text-slate-500">
            {status === "redirecting"
              ? "Đang chuyển hướng..."
              : "Đang kiểm tra phiên đăng nhập..."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
