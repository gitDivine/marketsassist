import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import FeedbackWidget from "@/components/FeedbackWidget";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Markets Assist — Buy vs Sell Pressure Dashboard",
  icons: { icon: "/logo.svg" },
  description:
    "Real-time buying vs selling pressure analysis across crypto, forex, and stocks with multi-timeframe confluence detection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Analytics />
        <FeedbackWidget />
        {/* DEV WATERMARK — NEVER merge this to master */}
        <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center opacity-[0.07]">
          <div className="h-72 w-72 rounded-full border-[3px] border-white flex items-center justify-center">
            <span className="text-white text-2xl font-black uppercase tracking-widest -rotate-12">DEV MODE</span>
          </div>
        </div>
      </body>
    </html>
  );
}
