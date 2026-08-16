export interface EqPreset {
  id: string;
  label: string;
  description: string;
}

export const eqPresets: EqPreset[] = [
  { id: "flat", label: "Flat", description: "No coloration — reference output." },
  { id: "warm", label: "Warm", description: "Boosted low-mids for a fuller tone." },
  { id: "bright", label: "Bright", description: "Lifted highs for clarity and presence." },
  { id: "podcast", label: "Podcast Voice", description: "Tuned for spoken-word intelligibility." },
  { id: "bass-boost", label: "Bass Boost", description: "Emphasized low end for depth." },
  { id: "telephone", label: "Telephone", description: "Band-limited, narrow vintage phone tone." },
  { id: "vintage-radio", label: "Vintage Radio", description: "Warm, compressed broadcast character." },
  { id: "de-ess", label: "De-Ess", description: "Tames harsh sibilance in the 5–8kHz range." },
];
