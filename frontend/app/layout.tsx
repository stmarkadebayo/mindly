import type { Metadata, Viewport } from "next";
import { Patrick_Hand } from "next/font/google";
import { HandDefs } from "@/components/Hand";
import { SessionProvider } from "@/components/Session";
import { UIProvider } from "@/components/UI";
import "./globals.css";
import "./screens.css";

// An upright, friendly handwriting face (no slant), used for the journal and display moments.
const hand = Patrick_Hand({ weight: "400", subsets: ["latin"], variable: "--font-hand", display: "swap" });

export const metadata: Metadata = {
  title: "Mindly",
  description: "A private, voice-first journal. Talk it out; Mindly keeps the page.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Mindly", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4fa" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

// Apply the saved theme before first paint so there's no flash.
const themeScript = `try{var t=localStorage.getItem("mindly.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={hand.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <HandDefs />
        <UIProvider>
          <SessionProvider>{children}</SessionProvider>
        </UIProvider>
      </body>
    </html>
  );
}
