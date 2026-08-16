import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mic2, Copy, Sparkles, Library, Play, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedWaveform } from "@/components/shared/AnimatedWaveform";
import { PublicNavbar } from "./components/PublicNavbar";

const ctas = [
  { label: "Create Voice", href: "/app/voice-studio", icon: Mic2 },
  { label: "Clone Voice", href: "/app/voice-clone", icon: Copy },
  { label: "Generate Speech", href: "/app/generate-speech", icon: Sparkles },
  { label: "Voice Library", href: "/app/voice-library", icon: Library },
];

const showcase = [
  { name: "Atlas", style: "Movie Trailer", gender: "Male", accent: "American" },
  { name: "Sable", style: "Podcast", gender: "Female", accent: "British" },
  { name: "Kestrel", style: "Narration", gender: "Non-binary", accent: "Australian" },
  { name: "Orion", style: "Villain", gender: "Male", accent: "Neutral" },
  { name: "Wren", style: "Storytelling", gender: "Female", accent: "Irish" },
  { name: "Halcyon", style: "Meditation", gender: "Female", accent: "American" },
];

const features = [
  {
    title: "Studio-grade voice cloning",
    body: "Clone any voice from minutes of audio with noise, clarity, and language detection built in.",
  },
  {
    title: "Full production suite",
    body: "Trim, split, fade, and automate volume on a real waveform timeline — no separate DAW required.",
  },
  {
    title: "Dozens of expressive controls",
    body: "Pitch, warmth, breathiness, rasp, energy, and a dozen more sliders with real-time preview.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial-glow" />
        <div className="container relative flex flex-col items-center gap-8 py-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-4 py-1.5 text-xs font-medium text-muted-foreground"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Now with 40+ realtime voice controls
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl"
          >
            The AI voice studio that{" "}
            <span className="text-gradient-brand">actually feels premium</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-xl text-lg text-muted-foreground"
          >
            Clone, direct, and produce studio-quality voice — with the polish of Figma and
            the power of a full audio production suite.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <AnimatedWaveform bars={32} className="h-16" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {ctas.map((cta) => (
              <Button key={cta.label} asChild variant="outline" className="h-auto flex-col gap-2 py-4">
                <Link to={cta.href}>
                  <cta.icon className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium">{cta.label}</span>
                </Link>
              </Button>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="voices" className="border-t border-border py-24">
        <div className="container">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Voices people are creating</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A glimpse of what's possible in the Voice Library.
              </p>
            </div>
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/app/voice-library">
                Browse library <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {showcase.map((voice, i) => (
              <motion.div
                key={voice.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <Card className="group cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-brand font-semibold text-white">
                      {voice.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{voice.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {voice.style} · {voice.gender} · {voice.accent}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-border bg-secondary/20 py-24">
        <div className="container grid grid-cols-1 gap-8 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="space-y-2">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border py-24">
        <div className="container flex flex-col items-center gap-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Ready to produce your first voice?</h2>
          <Button asChild variant="brand" size="lg">
            <Link to="/signup">
              Start for free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Voice Studio AI</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">
              Privacy
            </a>
            <a href="#" className="hover:text-foreground">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
