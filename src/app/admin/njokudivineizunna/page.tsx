"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, ExternalLink, RefreshCw, Image as ImageIcon, ClipboardList, Plus, Trash2 } from "lucide-react";
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

  // Survey state
  const [surveyQuestions, setSurveyQuestions] = useState<Array<{ id: string; type: string; question: string; options?: string[]; required: boolean; createdAt: string }>>([]);
  const [surveyStats, setSurveyStats] = useState<Array<{ questionId: string; question: string; totalResponses: number; answers: Record<string, number> }>>([]);
  const [newQ, setNewQ] = useState({ type: "multiple_choice" as string, question: "", options: ["", ""], required: false });
  const [showCreateForm, setShowCreateForm] = useState(false);

  const fetchFeedback = useCallback(async () => {
    try {
      const [fbRes, svRes] = await Promise.all([
        fetch("/api/feedback"),
        fetch("/api/survey?admin=true"),
      ]);
      if (fbRes.ok) {
        const fbData = await fbRes.json();
        setFeedback(fbData.feedback);
      }
      if (svRes.ok) {
        const svData = await svRes.json();
        setSurveyQuestions(svData.questions || []);
        setSurveyStats(svData.stats || []);
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
        {/* Survey Management */}
        <div className="flex items-center justify-between mt-8">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Surveys
          </h2>
          <button
            onClick={() => setShowCreateForm((v) => !v)}
            className="flex items-center gap-1 text-xs bg-accent text-white rounded-lg px-3 py-1.5 font-medium hover:bg-accent/80 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Question
          </button>
        </div>

        {/* Create question form */}
        {showCreateForm && (
          <div className="rounded-xl bg-card border border-border p-4 space-y-3">
            <div className="flex gap-2">
              {(["multiple_choice", "text", "rating"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setNewQ((q) => ({ ...q, type: t }))}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    newQ.type === t ? "bg-accent text-white" : "bg-card-hover text-muted hover:text-foreground"
                  )}
                >
                  {t === "multiple_choice" ? "Multiple Choice" : t === "text" ? "Text" : "Rating (1-5)"}
                </button>
              ))}
            </div>

            <input
              value={newQ.question}
              onChange={(e) => setNewQ((q) => ({ ...q, question: e.target.value }))}
              placeholder="Enter your question..."
              className="w-full rounded-lg border border-border bg-background p-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
            />

            {newQ.type === "multiple_choice" && (
              <div className="space-y-2">
                {newQ.options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={opt}
                      onChange={(e) => {
                        const opts = [...newQ.options];
                        opts[i] = e.target.value;
                        setNewQ((q) => ({ ...q, options: opts }));
                      }}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 rounded-lg border border-border bg-background p-2 text-sm text-foreground placeholder:text-muted focus:outline-none"
                    />
                    {newQ.options.length > 2 && (
                      <button
                        onClick={() => setNewQ((q) => ({ ...q, options: q.options.filter((_, j) => j !== i) }))}
                        className="text-red hover:text-red/70 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {newQ.options.length < 8 && (
                  <button
                    onClick={() => setNewQ((q) => ({ ...q, options: [...q.options, ""] }))}
                    className="text-xs text-accent hover:text-accent/70"
                  >
                    + Add option
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={newQ.required}
                  onChange={(e) => setNewQ((q) => ({ ...q, required: e.target.checked }))}
                  className="rounded"
                />
                Required
              </label>
              <button
                onClick={async () => {
                  if (!newQ.question.trim()) return;
                  const body: Record<string, unknown> = {
                    action: "create_question",
                    type: newQ.type,
                    question: newQ.question.trim(),
                    required: newQ.required,
                  };
                  if (newQ.type === "multiple_choice") {
                    body.options = newQ.options.filter((o) => o.trim());
                  }
                  await fetch("/api/survey", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  });
                  setNewQ({ type: "multiple_choice", question: "", options: ["", ""], required: false });
                  setShowCreateForm(false);
                  fetchFeedback();
                }}
                disabled={!newQ.question.trim()}
                className="bg-accent text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-accent/80 disabled:opacity-40 transition-colors"
              >
                Create Question
              </button>
            </div>
          </div>
        )}

        {/* Active questions + responses */}
        {surveyQuestions.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">
            No survey questions yet. Create one above.
          </div>
        ) : (
          <div className="space-y-3">
            {surveyQuestions.map((q) => {
              const stats = surveyStats.find((s) => s.questionId === q.id);
              return (
                <div key={q.id} className="rounded-xl bg-card border border-border p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-block rounded bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent uppercase mb-1">
                        {q.type.replace("_", " ")}
                      </span>
                      <p className="text-sm font-medium text-foreground">{q.question}</p>
                    </div>
                    <button
                      onClick={async () => {
                        await fetch("/api/survey", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "delete_question", questionId: q.id }),
                        });
                        fetchFeedback();
                      }}
                      className="text-red/60 hover:text-red p-1 transition-colors"
                      title="Delete question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {stats && stats.totalResponses > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted">{stats.totalResponses} response{stats.totalResponses !== 1 ? "s" : ""}</p>
                      {Object.entries(stats.answers)
                        .sort(([, a], [, b]) => b - a)
                        .map(([answer, count]) => (
                          <div key={answer} className="flex items-center gap-2">
                            <div className="flex-1 rounded-full bg-card-hover h-5 overflow-hidden">
                              <div
                                className="h-full bg-accent/30 rounded-full"
                                style={{ width: `${Math.round((count / stats.totalResponses) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-foreground min-w-[80px] truncate">{answer}</span>
                            <span className="text-xs text-muted tabular-nums">{Math.round((count / stats.totalResponses) * 100)}%</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted">No responses yet</p>
                  )}
                </div>
              );
            })}
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
