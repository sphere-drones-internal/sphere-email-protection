import type { Metadata } from "next";
import { Bai_Jamjuree, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

// next/font self-hosts these at build time (served from our own origin), so the
// strict CSP in src/proxy.ts doesn't need a font-src exception for a Google CDN.
const baiJamjuree = Bai_Jamjuree({
  subsets: ["latin"],
  weight: ["300", "500"],
  variable: "--font-bai-jamjuree",
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["300", "600"],
  variable: "--font-hanken-grotesk",
});

export const metadata: Metadata = {
  title: "Sphere DMARC",
  description: "Email authentication (DMARC, SPF & BIMI) monitoring dashboard for Sphere",
};

// Every route here is processed by src/proxy.ts and gets a fresh CSP nonce
// per request, so static optimization has no benefit — force dynamic rendering
// so the nonce is actually attached to Next's inline scripts. (Session checks are
// enforced upstream by the platform's Authentik forward-auth, not in-app.)
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${baiJamjuree.variable} ${hankenGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
