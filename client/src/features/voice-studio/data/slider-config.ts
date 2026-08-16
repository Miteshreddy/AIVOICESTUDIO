import type { VoiceAttributes } from "@/types/voice";

export interface SliderConfig {
  key: keyof VoiceAttributes;
  label: string;
  description: string;
}

export interface SliderGroup {
  id: string;
  title: string;
  sliders: SliderConfig[];
}

export const sliderGroups: SliderGroup[] = [
  {
    id: "core",
    title: "Core",
    sliders: [
      { key: "pitch", label: "Pitch", description: "Raises or lowers the fundamental tone of the voice." },
      { key: "speed", label: "Speed", description: "Overall speaking rate — lower is slower and more deliberate." },
    ],
  },
  {
    id: "emotional",
    title: "Emotional",
    sliders: [
      { key: "warmth", label: "Warmth", description: "How friendly and inviting the voice sounds." },
      { key: "confidence", label: "Confidence", description: "Assertiveness and certainty in delivery." },
      { key: "breathiness", label: "Breathiness", description: "Amount of audible breath texture in the voice." },
      { key: "rasp", label: "Rasp", description: "Gritty, textured quality layered over the tone." },
      { key: "energy", label: "Energy", description: "Overall vocal intensity and enthusiasm." },
    ],
  },
  {
    id: "style",
    title: "Style",
    sliders: [
      { key: "storytelling", label: "Storytelling", description: "Narrative rhythm and expressive emphasis." },
      { key: "calmness", label: "Calmness", description: "Soothing, unhurried quality of delivery." },
      { key: "professionalism", label: "Professionalism", description: "Polished, corporate-appropriate tone." },
      { key: "sarcasm", label: "Sarcasm", description: "Dry, ironic inflection." },
      { key: "humor", label: "Humor", description: "Playful, lighthearted delivery." },
    ],
  },
  {
    id: "naturalness",
    title: "Naturalness",
    sliders: [
      { key: "naturalness", label: "Naturalness", description: "How closely the voice mimics natural human speech." },
      { key: "conversationalLevel", label: "Conversational Level", description: "Casualness vs. formal, scripted delivery." },
      { key: "dynamicRange", label: "Dynamic Range", description: "Variation in loudness and emphasis across a sentence." },
    ],
  },
  {
    id: "texture",
    title: "Texture",
    sliders: [
      { key: "brightness", label: "Brightness", description: "High-frequency presence — brighter feels sharper and closer." },
      { key: "depth", label: "Depth", description: "Low-frequency richness — more depth feels heavier and larger." },
      { key: "resonance", label: "Resonance", description: "Fullness and body of the tone." },
    ],
  },
];
