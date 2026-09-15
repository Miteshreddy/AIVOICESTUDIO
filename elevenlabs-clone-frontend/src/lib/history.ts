import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { ServiceType } from "~/types/services";
import { getPresignedUrl } from "~/lib/s3";

export interface HistoryItem {
  id: string;
  title: string;
  voice: string;
  audioUrl: string | null;
  service: ServiceType;
  date: string;
  time: string;
}

function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = today.getTime() - itemDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export async function getHistoryItems(
  service: ServiceType,
): Promise<HistoryItem[]> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return [];
    }

    const clips = await db.generatedAudioClip.findMany({
      where: {
        userId: session.user.id,
        service: service,
        failed: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const items: HistoryItem[] = await Promise.all(
      clips.map(async (clip) => {
        let audioUrl: string | null = null;
        if (clip.s3Key) {
          try {
            audioUrl = await getPresignedUrl({ key: clip.s3Key });
          } catch (err) {
            console.error(`Failed to resolve audio url for clip ${clip.id}:`, err);
          }
        }

        return {
          id: clip.id,
          title: clip.text || (clip.service === "seedvc" ? "Voice conversion" : "Generated Audio"),
          voice: clip.voice || "",
          audioUrl,
          service: clip.service as ServiceType,
          date: formatDateLabel(clip.createdAt),
          time: formatTimeLabel(clip.createdAt),
        };
      }),
    );

    return items;
  } catch (error) {
    console.error("Error fetching history items:", error);
    return [];
  }
}
