import { PresetPanel } from "./components/PresetPanel";
import { TextEditorPanel } from "./components/TextEditorPanel";
import { VoiceControlsPanel } from "./components/VoiceControlsPanel";

export default function VoiceStudioPage() {
  return (
    <div className="grid h-full grid-cols-[260px_1fr_320px] overflow-hidden">
      <PresetPanel />
      <TextEditorPanel />
      <VoiceControlsPanel />
    </div>
  );
}
