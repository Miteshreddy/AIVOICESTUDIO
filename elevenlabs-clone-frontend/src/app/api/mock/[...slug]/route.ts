import { NextRequest, NextResponse } from "next/server";
import { getPresignedUrl } from "~/lib/s3";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const services = {
  styletts2: {
    voices: ["andreas", "woman", "adam", "antoni", "josh"],
  },
  "seed-vc": {
    voices: ["andreas", "woman", "trump", "adam", "antoni", "josh"],
  },
  "make-an-audio": {
    voices: [],
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const awaitedParams = await params;
  const slug = awaitedParams.slug;
  const [service, endpoint] = slug;

  if (!services[service as keyof typeof services]) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  if (endpoint === "voices") {
    return NextResponse.json({
      voices: services[service as keyof typeof services].voices,
    });
  }

  if (endpoint === "health") {
    return NextResponse.json({
      status: "healthy",
      model: "loaded",
    });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const awaitedParams = await params;
  const slug = awaitedParams.slug;
  const [service, endpoint] = slug;

  if (!services[service as keyof typeof services]) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // empty body
    }

    const storageDir = path.resolve(process.cwd(), ".audio-storage");
    const audioId = randomUUID();
    let s3Key = "";
    let args: string[] = [];

    const scriptPath = path.resolve(process.cwd(), "scripts", "generate_audio.py");

    if (service === "styletts2") {
      s3Key = `styletts2-output/${audioId}.mp3`;
      const outputPath = path.resolve(storageDir, s3Key);
      const text = body.text || "Hello from ElevenLabs clone.";
      const voice = body.target_voice || "andreas";
      args = [
        scriptPath,
        "--service", "styletts2",
        "--voice", voice,
        "--text", text,
        "--output", outputPath,
      ];
    } else if (service === "seed-vc") {
      s3Key = `seedvc-outputs/${audioId}.wav`;
      const outputPath = path.resolve(storageDir, s3Key);
      const voice = body.target_voice || "andreas";
      const sourceAudioKey = body.source_audio_key || "";
      const sourcePath = sourceAudioKey ? path.resolve(storageDir, sourceAudioKey) : "";
      args = [
        scriptPath,
        "--service", "seed-vc",
        "--voice", voice,
        "--source", sourcePath,
        "--output", outputPath,
      ];
    } else if (service === "make-an-audio") {
      s3Key = `make-an-audio-outputs/${audioId}.wav`;
      const outputPath = path.resolve(storageDir, s3Key);
      const prompt = body.prompt || "ambient sound";
      args = [
        scriptPath,
        "--service", "make-an-audio",
        "--text", prompt,
        "--output", outputPath,
      ];
    }

    // Run python audio generator
    try {
      await execFileAsync("python", args);
    } catch (pythonError) {
      console.error("Python audio generation error:", pythonError);
    }

    const presignedUrl = await getPresignedUrl({ key: s3Key });

    return NextResponse.json({
      audio_url: presignedUrl,
      s3_key: s3Key,
    });
  } catch (err: any) {
    console.error("Generation handler error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate audio" },
      { status: 500 },
    );
  }
}
