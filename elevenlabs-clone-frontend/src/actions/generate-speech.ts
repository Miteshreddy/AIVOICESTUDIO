"use server";

import { revalidatePath } from "next/cache";
import { inngest } from "~/inngest/client";
import { getPresignedUrl, getUploadUrl } from "~/lib/s3";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { type ServiceType } from "~/types/services";
import { env } from "~/env";

async function processAudioClipDirectly(audioClipId: string) {
  try {
    const audioClip = await db.generatedAudioClip.findUnique({
      where: { id: audioClipId },
      select: {
        id: true,
        text: true,
        voice: true,
        userId: true,
        service: true,
        originalVoiceS3Key: true,
        s3Key: true,
      },
    });

    if (!audioClip || audioClip.s3Key) {
      return;
    }

    let response: Response | null = null;
    if (audioClip.service === "styletts2") {
      response = await fetch(env.STYLETTS2_API_ROUTE + "/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: env.BACKEND_API_KEY,
        },
        body: JSON.stringify({
          text: audioClip.text,
          target_voice: audioClip.voice,
        }),
      });
    } else if (audioClip.service === "seedvc") {
      response = await fetch(env.SEED_VC_API_ROUTE + "/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: env.BACKEND_API_KEY,
        },
        body: JSON.stringify({
          source_audio_key: audioClip.originalVoiceS3Key,
          target_voice: audioClip.voice,
        }),
      });
    } else if (audioClip.service === "make-an-audio") {
      response = await fetch(env.MAKE_AN_AUDIO_API_ROUTE + "/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: env.BACKEND_API_KEY,
        },
        body: JSON.stringify({
          prompt: audioClip.text,
        }),
      });
    }

    if (!response || !response.ok) {
      await db.generatedAudioClip.update({
        where: { id: audioClip.id },
        data: { failed: true },
      });
      return;
    }

    const result = (await response.json()) as { audio_url: string; s3_key: string };
    await db.generatedAudioClip.update({
      where: { id: audioClip.id },
      data: { s3Key: result.s3_key },
    });
    // No credits deducted - unlimited generations
  } catch (error) {
    console.error("Direct processing error:", error);
  }
}

export async function generateTextToSpeech(text: string, voice: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("User not authenticated");
  }

  const audioClipJob = await db.generatedAudioClip.create({
    data: {
      text: text,
      voice: voice,
      user: {
        connect: {
          id: session.user.id,
        },
      },
      service: "styletts2",
    },
  });

  try {
    await inngest.send({
      name: "generate.request",
      data: {
        audioClipId: audioClipJob.id,
        userId: session.user.id,
      },
    });
  } catch {
    // Inngest offline fallback
  }

  processAudioClipDirectly(audioClipJob.id).catch(console.error);

  return {
    audioId: audioClipJob.id,
    shouldShowThrottleAlert: false,
  };
}

export async function generateSpeechToSpeech(
  originalVoiceS3Key: string,
  voice: string,
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("User not authenticated");
  }

  const audioClipJob = await db.generatedAudioClip.create({
    data: {
      originalVoiceS3Key: originalVoiceS3Key,
      voice: voice,
      user: {
        connect: {
          id: session.user.id,
        },
      },
      service: "seedvc",
    },
  });

  try {
    await inngest.send({
      name: "generate.request",
      data: {
        audioClipId: audioClipJob.id,
        userId: session.user.id,
      },
    });
  } catch {
    // Inngest offline fallback
  }

  processAudioClipDirectly(audioClipJob.id).catch(console.error);

  return {
    audioId: audioClipJob.id,
    shouldShowThrottleAlert: false,
  };
}

export async function generateSoundEffect(prompt: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("User not authenticated");
  }

  const audioClipJob = await db.generatedAudioClip.create({
    data: {
      text: prompt,
      user: {
        connect: {
          id: session.user.id,
        },
      },
      service: "make-an-audio",
    },
  });

  try {
    await inngest.send({
      name: "generate.request",
      data: {
        audioClipId: audioClipJob.id,
        userId: session.user.id,
      },
    });
  } catch {
    // Inngest offline fallback
  }

  processAudioClipDirectly(audioClipJob.id).catch(console.error);

  return {
    audioId: audioClipJob.id,
    shouldShowThrottleAlert: false,
  };
}

export async function generationStatus(
  audioId: string,
): Promise<{ success: boolean; audioUrl: string | null }> {
  const session = await auth();

  const audioClip = await db.generatedAudioClip.findFirstOrThrow({
    where: { id: audioId, userId: session?.user?.id },
    select: {
      id: true,
      failed: true,
      s3Key: true,
      service: true,
    },
  });

  if (audioClip.failed) {
    revalidateBasedOnService(audioClip.service as ServiceType);
    return { success: false, audioUrl: null };
  }

  if (audioClip.s3Key) {
    revalidateBasedOnService(audioClip.service as ServiceType);
    return {
      success: true,
      audioUrl: await getPresignedUrl({ key: audioClip.s3Key }),
    };
  }

  return {
    success: true,
    audioUrl: null,
  };
}

const revalidateBasedOnService = async (service: ServiceType) => {
  switch (service) {
    case "styletts2":
      revalidatePath("/app/speech-synthesis/text-to-speech");
      break;
    case "seedvc":
      revalidatePath("/app/speech-synthesis/speech-to-speech");
      break;
    case "make-an-audio":
      revalidatePath("/app/sound-effects/history");
      break;
  }
};

export async function generateUploadUrl(fileType: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("User not authenticated");
  }

  return await getUploadUrl(fileType);
}
