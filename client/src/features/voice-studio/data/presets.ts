import {
  Youtube,
  Mic,
  BookOpen,
  Megaphone,
  Clapperboard,
  Film,
  Sparkles,
  Wind,
  Newspaper,
  Gamepad2,
  Ghost,
  Flame,
  Baby,
  GraduationCap,
  Glasses,
  Drama,
  Cat,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { VoiceAttributes } from "@/types/voice";
import { defaultVoiceAttributes } from "@/types/voice";

export interface VoicePreset {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  attributes: Partial<VoiceAttributes>;
}

function preset(
  id: string,
  label: string,
  description: string,
  icon: LucideIcon,
  attributes: Partial<VoiceAttributes>,
): VoicePreset {
  return { id, label, description, icon, attributes };
}

export const voicePresets: VoicePreset[] = [
  preset("youtube", "YouTube", "Energetic, clear, built to hook viewers in the first 3 seconds.", Youtube, {
    energy: 75,
    conversationalLevel: 70,
    brightness: 65,
  }),
  preset("podcast", "Podcast", "Warm, conversational, effortless long-form listening.", Mic, {
    warmth: 80,
    conversationalLevel: 85,
    calmness: 55,
  }),
  preset("audiobook", "Audiobook", "Naturalistic pacing with rich storytelling cadence.", BookOpen, {
    storytelling: 85,
    naturalness: 90,
    speed: 45,
  }),
  preset("commercial", "Commercial", "Bright, persuasive, radio-ready delivery.", Megaphone, {
    brightness: 80,
    confidence: 80,
    professionalism: 75,
  }),
  preset("trailer", "Trailer", "Deep, dramatic, larger-than-life gravitas.", Clapperboard, {
    depth: 90,
    confidence: 95,
    speed: 35,
  }),
  preset("documentary", "Documentary", "Measured, authoritative, credible narration.", Film, {
    professionalism: 85,
    calmness: 70,
    naturalness: 85,
  }),
  preset("storytelling", "Storytelling", "Expressive, melodic, emotionally dynamic.", Sparkles, {
    storytelling: 90,
    dynamicRange: 80,
    humor: 30,
  }),
  preset("meditation", "Meditation", "Slow, soft, deeply calming breath control.", Wind, {
    calmness: 95,
    speed: 25,
    breathiness: 50,
  }),
  preset("news", "News", "Crisp, neutral, fast-paced and authoritative.", Newspaper, {
    professionalism: 90,
    speed: 60,
    confidence: 75,
  }),
  preset("gaming", "Gaming", "High energy, punchy, hype commentary.", Gamepad2, {
    energy: 95,
    speed: 65,
    confidence: 85,
  }),
  preset("horror", "Horror", "Tense, whispery, unsettling atmosphere.", Ghost, {
    breathiness: 60,
    calmness: 20,
    rasp: 45,
  }),
  preset("motivational", "Motivational", "Powerful, driving, inspirational momentum.", Flame, {
    energy: 85,
    confidence: 90,
    dynamicRange: 75,
  }),
  preset("kids", "Kids", "Playful, bright, exaggerated warmth.", Baby, {
    brightness: 85,
    humor: 60,
    energy: 70,
  }),
  preset("teacher", "Teacher", "Patient, clear, encouraging pace.", GraduationCap, {
    professionalism: 65,
    calmness: 65,
    speed: 45,
  }),
  preset("professor", "Professor", "Measured, articulate, academic authority.", Glasses, {
    professionalism: 90,
    speed: 40,
    depth: 60,
  }),
  preset("comedy", "Comedy", "Snappy timing, playful inflection.", Drama, {
    humor: 80,
    sarcasm: 40,
    energy: 65,
  }),
  preset("anime", "Anime", "Exaggerated, expressive, highly dynamic.", Cat, {
    dynamicRange: 90,
    energy: 80,
    brightness: 70,
  }),
  preset("movie-narrator", "Movie Narrator", "Rich, cinematic, classic narrator tone.", Video, {
    depth: 80,
    professionalism: 80,
    storytelling: 60,
  }),
];

export function applyPreset(attributes: VoiceAttributes, preset: VoicePreset): VoiceAttributes {
  return { ...attributes, ...preset.attributes };
}

export { defaultVoiceAttributes };
