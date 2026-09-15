import "~/styles/globals.css";

import { type Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Kaiz Studio - Audio Workstation",
  description: "Neural voice synthesis, voice conversion, and audio generation studio.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${inter.className}`}>
      <body className="bg-[#0d0e11] text-zinc-100 antialiased selection:bg-zinc-700 selection:text-white">
        <Toaster
          toastOptions={{
            style: {
              background: "#17181d",
              color: "#f4f4f5",
              border: "1px solid #23252a",
              borderRadius: "8px",
              fontSize: "13px",
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}
