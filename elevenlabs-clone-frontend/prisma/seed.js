import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@elevenlabs.io";
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (!existing) {
    const hashedPassword = await bcrypt.hash("password123", 10);
    const user = await prisma.user.create({
      data: {
        name: "Demo User",
        email: email,
        password: hashedPassword,
        credits: 10000,
      },
    });
    console.log("Created demo user:", user.email);
  } else {
    console.log("Demo user already exists:", existing.email);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
