import NextAuth from "next-auth";
import { cache } from "react";
import { authConfig } from "./config";
import { db } from "~/server/db";

const { auth: uncachedNextAuth, handlers, signIn, signOut } = NextAuth(authConfig);

const uncachedAuth = async () => {
  try {
    const session = await uncachedNextAuth();
    if (session?.user?.id) {
      return session;
    }
  } catch {
    // No session cookie
  }

  try {
    let user = await db.user.findFirst({
      where: { email: "demo@elevenlabs.io" },
    });
    if (!user) {
      user = await db.user.findFirst();
    }
    if (!user) {
      user = await db.user.create({
        data: {
          name: "Studio User",
          email: "demo@elevenlabs.io",
          password: "password123",
          credits: 1000000,
        },
      });
    }

    return {
      user: {
        id: user.id,
        name: user.name ?? "Studio User",
        email: user.email ?? "demo@elevenlabs.io",
      },
      expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
  } catch (err) {
    console.error("Local studio user load error:", err);
    return null;
  }
};

const auth = cache(uncachedAuth);

export { auth, handlers, signIn, signOut };

