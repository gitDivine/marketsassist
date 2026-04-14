"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, ExternalLink, RefreshCw, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackEntry {
  id: string;
  text: string;
  image: string | null;
  createdAt: string;
  userAgent: string;
  page: string;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function shortenUA(ua: string): string {
  if (ua.length <= 60) return ua;
  // Try to extract browser info
  const match = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/);
  if (match) return match[0];
  return ua.slice(0, 57) + "…";
}

export default function AdminDashboard() {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);


  const fetchFeedback = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback");
      if (res.ok) {
        const data = await res.json();
        setFeedback(data.feedback);
      }
    } catch {
      // Silently fail on refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedback();
    const interval = setInterval(fetchFeedback, 30_000);
    return () => clearInterval(interval);
  }, [fetchFeedback]);

  const todayCount = feedback.filter((f) => {
    const d = new Date(f.createdAt);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-4 py-6 sm:px-8">
        <h1 className="text-xl font-bold">Market Assist — Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Feedback management and analytics
        </p>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6 sm:px-8">
        {/* Overview cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-card border border-border p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Total Feedback
            </p>
            <p className="text-3xl font-bold mt-1">{feedback.length}</p>
          </div>

          <div className="rounded-xl bg-card border border-border p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Today
            </p>
            <p className="text-3xl font-bold mt-1">{todayCount}</p>
          </div>

          {/* Analytics link */}
          <a
            href="https://vercel.com/0xdivine-s-projects/marketsassist/analytics"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "rounded-xl bg-card border border-border p-5",
              "flex items-center justify-between gap-3",
              "hover:bg-accent transition-colors group"
            )}
          >
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Analytics
              </p>
              <p className="text-sm font-medium mt-1 group-hover:underline">
                Vercel Dashboard
              </p>
            </div>
            <ExternalLink className="h-5 w-5 text-muted-foreground" />
          </a>
        </div>

        {/* Feedback list header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Feedback
          </h2>
          <button
            onClick={() => {
              setLoading(true);
              fetchFeedback();
            }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* Feedback entries */}
        {loading && feedback.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Loading feedback…
          </div>
        ) : feedback.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground text-sm">
              No feedback yet. Entries will appear here once users submit them.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {feedback.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl bg-card border border-border p-4 space-y-2"
              >
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {entry.text}
                </p>

                {entry.image && (
                  <button
                    onClick={() => setExpandedImage(entry.image)}
                    className="block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.image}
                      alt="Feedback attachment"
                      className="h-16 w-16 rounded-lg object-cover border border-border hover:opacity-80 transition-opacity"
                    />
                  </button>
                )}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{timeAgo(entry.createdAt)}</span>
                  <span>·</span>
                  <span>{entry.page}</span>
                  {entry.image && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" />
                        image
                      </span>
                    </>
                  )}
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">{shortenUA(entry.userAgent)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Image lightbox */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={expandedImage}
            alt="Expanded feedback attachment"
            className="max-w-full max-h-[85vh] rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
