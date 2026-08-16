import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatedWaveform } from "@/components/shared/AnimatedWaveform";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-brand p-10 text-white lg:flex">
        <div className="absolute inset-0 bg-gradient-radial-glow opacity-40" />
        <Link to="/" className="relative z-10 flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-white/20" />
          <span className="font-semibold tracking-tight">Voice Studio AI</span>
        </Link>

        <div className="relative z-10 space-y-6">
          <blockquote className="text-2xl font-medium leading-snug">
            "The most natural AI voices I've ever heard — and the fastest workflow
            I've ever used to produce them."
          </blockquote>
          <AnimatedWaveform bars={24} className="h-10 opacity-80" barClassName="bg-white" />
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 text-center lg:text-left">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          <div className="text-center text-sm text-muted-foreground lg:text-left">{footer}</div>
        </div>
      </div>
    </div>
  );
}
