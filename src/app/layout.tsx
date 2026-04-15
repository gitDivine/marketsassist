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
  title: "Market Assist — Buy vs Sell Pressure Dashboard",
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
        {/* DEV TEST */}
        <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
          <div className="h-80 w-80 rounded-full border-[6px] border-red/40 flex items-center justify-center">
            <span className="text-red/50 text-3xl font-black uppercase tracking-widest -rotate-12">DEV MODE</span>
          </div>
        </div>
      </body>
    </html>
  );
}
