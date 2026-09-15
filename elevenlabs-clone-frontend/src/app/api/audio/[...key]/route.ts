import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const awaitedParams = await params;
  const keyParts = awaitedParams.key || [];
  const relativeKey = keyParts.map(decodeURIComponent).join("/");

  const storageDir = path.resolve(process.cwd(), ".audio-storage");
  const filePath = path.resolve(storageDir, relativeKey);

  if (!filePath.startsWith(storageDir)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Audio file not found", { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === ".mp3" ? "audio/mpeg" : "audio/wav";

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Length": fileSize.toString(),
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
