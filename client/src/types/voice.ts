export interface VoiceAttributes {
  pitch: number;
  speed: number;
  warmth: number;
  confidence: number;
  breathiness: number;
  rasp: number;
  energy: number;
  storytelling: number;
  calmness: number;
  professionalism: number;
  sarcasm: number;
  humor: number;
  naturalness: number;
  conversationalLevel: number;
  dynamicRange: number;
  brightness: number;
  depth: number;
  resonance: number;
}

export const defaultVoiceAttributes: VoiceAttributes = {
  pitch: 50,
  speed: 50,
  warmth: 60,
  confidence: 55,
  breathiness: 20,
  rasp: 10,
  energy: 55,
  storytelling: 40,
  calmness: 50,
  professionalism: 60,
  sarcasm: 10,
  humor: 15,
  naturalness: 80,
  conversationalLevel: 50,
  dynamicRange: 55,
  brightness: 50,
  depth: 45,
  resonance: 50,
};
