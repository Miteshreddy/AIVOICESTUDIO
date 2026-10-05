import { cn } from "@/lib/utils";

function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic two-tone palette per voice, so every voice has its own face. */
function voiceColors(seed: string) {
  const h = hash(seed);
  const hue = h % 360;
  const hue2 = (hue + 40 + ((h >> 9) % 80)) % 360;
  return {
    a: `hsl(${hue} 85% 62%)`,
    b: `hsl(${hue2} 80% 52%)`,
    angle: (h >> 3) % 360,
  };
}

/**
 * A soft, glossy orb that stands in for a voice's "face". It breathes when the
 * voice is speaking.
 */
export function VoiceOrb({
  seed,
  size = 40,
  active = false,
  className,
}: {
  seed: string;
  size?: number;
  active?: boolean;
  className?: string;
}) {
  const { a, b, angle } = voiceColors(seed);
  return (
    <span
      aria-hidden
      className={cn("relative inline-block shrink-0 rounded-full", active && "animate-orb-speak", className)}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(from ${angle}deg, ${a}, ${b}, ${a})`,
        boxShadow: active ? `0 0 ${size / 2}px ${a}66` : undefined,
      }}
    >
      <span
        className={cn("absolute inset-0 rounded-full", active && "animate-orb-swirl")}
        style={{
          background: `radial-gradient(circle at 30% 28%, rgba(255,255,255,.75), rgba(255,255,255,0) 42%),
                       radial-gradient(circle at 72% 78%, ${b}, transparent 60%)`,
        }}
      />
    </span>
  );
}
