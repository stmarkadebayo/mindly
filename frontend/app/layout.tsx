import type { Metadata, Viewport } from "next";
import { Patrick_Hand } from "next/font/google";
import { HandDefs } from "@/components/Hand";
import { SessionProvider } from "@/components/Session";
import { Shell } from "@/components/Shell";
import { UIProvider } from "@/components/UI";
import "./globals.css";
import "./screens.css";

// An upright, friendly handwriting face (no slant), used for the journal and display moments.
const hand = Patrick_Hand({ weight: "400", subsets: ["latin"], variable: "--font-hand", display: "swap" });

const SITE = "https://mindly-ai.duckdns.org";
const DESCRIPTION = "A private, voice-first journal. Talk it out; Mindly keeps the page.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Mindly",
  description: DESCRIPTION,
  openGraph: { type: "website", url: SITE, siteName: "Mindly", title: "Mindly", description: DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Mindly, a voice-first journal" }] },
  twitter: { card: "summary_large_image", title: "Mindly", description: DESCRIPTION, images: ["/og.png"] },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/apple-touch-icon.png" },
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
          <SessionProvider><Shell>{children}</Shell></SessionProvider>
        </UIProvider>
      </body>
    </html>
  );
}
