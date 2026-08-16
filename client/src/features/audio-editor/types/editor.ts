export interface EditorMarker {
  id: string;
  time: number;
  label: string;
}

export interface AutomationPoint {
  id: string;
  time: number;
  value: number; // 0–1
}

export interface EditorSegment {
  id: string;
  start: number;
  end: number;
  fadeIn: number;
  fadeOut: number;
}

export interface EditorSnapshot {
  segments: EditorSegment[];
  markers: EditorMarker[];
  automation: AutomationPoint[];
}
