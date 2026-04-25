import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/shell";
import { getSession } from "@/lib/session";

const sans = Bricolage_Grotesque({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "SNCTM // Transport Operations",
  description: "Transport operations console — Sanctum schools.",
};

// Explicit viewport so iOS Safari doesn't shrink the layout, doesn't auto-zoom
// when tapping inputs (16px+ minimum font-size on inputs handles that), and
// renders right under the notch / dynamic island on phones.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#f5f0e6",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Shell user={session.user ?? null}>{children}</Shell>
      </body>
    </html>
  );
}
