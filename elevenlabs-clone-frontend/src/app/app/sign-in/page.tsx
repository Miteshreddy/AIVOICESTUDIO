"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { type SignInFormValues, signInSchema } from "~/schemas/auth";
import { IoSparkles, IoShieldCheckmarkOutline } from "react-icons/io5";

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onChange",
  });

  const email = watch("email");
  const password = watch("password");

  useEffect(() => {
    setIsFormValid(!!email && !!password);
  }, [email, password]);

  const onSubmit = async (data: SignInFormValues) => {
    try {
      setIsLoading(true);

      const signInResult = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
      });

      if (!signInResult?.error) {
        router.push("/app/speech-synthesis/text-to-speech");
      } else {
        setError(
          signInResult.error === "CredentialsSignin"
            ? "Invalid email or password"
            : "Something went wrong",
        );
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[#090a10] text-gray-100">
      <div className="relative flex flex-col justify-between w-full lg:w-1/2 p-8 sm:p-12">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-500/30">
            <span className="text-sm font-black tracking-wider text-white">KZ</span>
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-wider bg-gradient-to-r from-white via-gray-200 to-indigo-300 bg-clip-text text-transparent">
              KAIZ VOICE STUDIO
            </span>
            <span className="block text-[10px] uppercase tracking-widest text-indigo-400 font-semibold">
              AI Voice & Audio Platform
            </span>
          </div>
        </div>

        {/* Centered Sign In Form */}
        <div className="flex items-center justify-center my-auto py-8">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1322]/80 backdrop-blur-xl p-8 shadow-2xl">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black tracking-tight text-white">
                Welcome Back
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Enter your credentials to access the AI audio suite
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-300"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="demo@elevenlabs.io"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-400">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-300"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  {...register("password")}
                  placeholder="password123"
                  required
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-red-400">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !isFormValid}
                className={`mt-4 w-full rounded-xl py-3 text-sm font-bold text-white transition-all duration-200 ${
                  isLoading || !isFormValid
                    ? "cursor-not-allowed bg-gray-800 text-gray-500 opacity-60"
                    : "bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 shadow-lg shadow-indigo-500/30 hover:brightness-110 active:scale-95"
                }`}
              >
                {isLoading ? "Authenticating..." : "Sign In to Studio"}
              </button>

              <div className="pt-3 text-center">
                <span className="text-xs text-gray-400">
                  Don't have an account?{" "}
                  <a
                    className="font-semibold text-indigo-400 hover:text-indigo-300 underline"
                    href="/app/sign-up"
                  >
                    Create Free Account
                  </a>
                </span>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-600">
          KAIZ VOICE STUDIO · Powered by Self-Hosted Neural Audio
        </div>
      </div>

      {/* Right Side Showcase */}
      <div className="hidden lg:flex lg:w-1/2 p-6">
        <div className="h-full w-full rounded-3xl bg-gradient-to-br from-indigo-950/60 via-[#101426] to-purple-950/60 border border-white/10 p-12 flex flex-col justify-between relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
              <IoSparkles className="h-3.5 w-3.5" />
              KAIZ PRO ENGINE
            </span>
          </div>

          <div className="max-w-md">
            <h3 className="text-3xl font-extrabold text-white tracking-tight leading-tight mb-4">
              State-of-the-Art AI Voice Synthesis & Voice Cloning
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed mb-6">
              Create lifelike speech, transform any voice in real-time, generate cinematic acoustic effects, and clone custom voices with zero limits.
            </p>

            <div className="flex flex-col gap-3">
              {[
                "Instant Neural Voice Synthesis",
                "Self-Hosted Unlimited Voice Cloning",
                "Sound Effects Generator with Waveform Playback",
                "100% Free & Unlimited Generations",
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-2 text-xs text-gray-300">
                  <IoShieldCheckmarkOutline className="text-emerald-400 h-4 w-4 flex-shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-gray-500">
            KAIZ VOICE STUDIO © 2026. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
