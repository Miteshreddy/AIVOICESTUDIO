import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";
import { AnimatedWaveform } from "@/components/shared/AnimatedWaveform";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuthStore();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <AnimatedWaveform bars={20} className="h-10" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
