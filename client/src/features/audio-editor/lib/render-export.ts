import type { AutomationPoint, EditorSegment } from "../types/editor";

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + buffer.length * numChannels * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, buffer.length * numChannels * 2, true);

  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i));

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

export async function renderEditedAudio(
  sourceBuffer: AudioBuffer,
  segments: EditorSegment[],
  automation: AutomationPoint[],
): Promise<Blob> {
  const ordered = [...segments].sort((a, b) => a.start - b.start);
  const totalDuration = ordered.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
  if (totalDuration <= 0) throw new Error("Nothing to render — all segments are empty.");

  const OfflineCtor =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const offlineCtx = new OfflineCtor(
    sourceBuffer.numberOfChannels,
    Math.ceil(totalDuration * sourceBuffer.sampleRate),
    sourceBuffer.sampleRate,
  );

  const masterGain = offlineCtx.createGain();
  masterGain.connect(offlineCtx.destination);

  // Apply the volume-automation envelope across the full rendered timeline.
  if (automation.length > 0) {
    const sorted = [...automation].sort((a, b) => a.time - b.time);
    masterGain.gain.setValueAtTime(sorted[0].value, 0);
    let renderedTime = 0;
    let sourceCursor = 0;
    for (const seg of ordered) {
      const segDuration = seg.end - seg.start;
      for (const point of sorted) {
        if (point.time >= seg.start && point.time <= seg.end) {
          const renderTime = renderedTime + (point.time - seg.start);
          masterGain.gain.linearRampToValueAtTime(point.value, renderTime);
        }
      }
      renderedTime += segDuration;
      sourceCursor += segDuration;
    }
    void sourceCursor;
  }

  let cursor = 0;
  for (const seg of ordered) {
    const segDuration = seg.end - seg.start;
    if (segDuration <= 0) continue;

    const src = offlineCtx.createBufferSource();
    src.buffer = sourceBuffer;

    const segGain = offlineCtx.createGain();
    src.connect(segGain);
    segGain.connect(masterGain);

    segGain.gain.setValueAtTime(1, cursor);
    if (seg.fadeIn > 0) {
      const fadeInDur = Math.min(seg.fadeIn, segDuration);
      segGain.gain.setValueAtTime(0, cursor);
      segGain.gain.linearRampToValueAtTime(1, cursor + fadeInDur);
    }
    if (seg.fadeOut > 0) {
      const fadeOutDur = Math.min(seg.fadeOut, segDuration);
      segGain.gain.setValueAtTime(1, cursor + segDuration - fadeOutDur);
      segGain.gain.linearRampToValueAtTime(0, cursor + segDuration);
    }

    src.start(cursor, seg.start, segDuration);
    cursor += segDuration;
  }

  const rendered = await offlineCtx.startRendering();
  return audioBufferToWav(rendered);
}
