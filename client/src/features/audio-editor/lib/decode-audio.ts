export async function decodeAudioPeaks(
  file: File,
  buckets = 1200,
): Promise<{ duration: number; peaks: number[]; audioBuffer: AudioBuffer }> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextCtor();

  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);
  const samplesPerBucket = Math.max(1, Math.floor(channelData.length / buckets));

  const peaks: number[] = [];
  for (let i = 0; i < buckets; i++) {
    const start = i * samplesPerBucket;
    let max = 0;
    for (let j = 0; j < samplesPerBucket; j++) {
      const sample = channelData[start + j];
      if (sample !== undefined) max = Math.max(max, Math.abs(sample));
    }
    peaks.push(max);
  }

  await audioContext.close();
  return { duration: audioBuffer.duration, peaks, audioBuffer };
}
