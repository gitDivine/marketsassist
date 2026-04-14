"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronRight, Star, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";

interface SurveyQuestion {
  id: string;
  type: "multiple_choice" | "text" | "rating";
  question: string;
  options?: string[];
  required: boolean;
}

const STORAGE_KEY = "mktassist_survey";

function getSurveyState(): { dismissed: boolean; answered: string[] } {
  if (typeof window === "undefined") return { dismissed: false, answered: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { dismissed: false, answered: [] };
}

function saveSurveyState(state: { dismissed: boolean; answered: string[] }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export default function SurveyPopup() {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [answer, setAnswer] = useState("");
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [state, setState] = useState({ dismissed: false, answered: [] as string[] });

  // Fetch questions after 15 seconds
  useEffect(() => {
    const saved = getSurveyState();
    setState(saved);

    if (saved.dismissed) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/survey");
        if (!res.ok) return;
        const data = await res.json();

        // Filter out already answered questions
        const unanswered = (data.questions || []).filter(
          (q: SurveyQuestion) => !saved.answered.includes(q.id)
        );

        if (unanswered.length > 0) {
          setQuestions(unanswered);
          setVisible(true);
        }
      } catch {}
    }, 15000);

    return () => clearTimeout(timer);
  }, []);

  const currentQ = questions[currentIndex];

  const submitAnswer = useCallback(async () => {
    if (!currentQ) return;

    const answerValue =
      currentQ.type === "rating" ? String(rating) : answer;

    if (!answerValue && currentQ.required) return;

    try {
      await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "respond",
          questionId: currentQ.id,
          answer: answerValue,
        }),
      });
    } catch {}

    // Mark as answered
    const newState = {
      ...state,
      answered: [...state.answered, currentQ.id],
    };
    setState(newState);
    saveSurveyState(newState);

    // Show brief success then move to next
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setAnswer("");
      setRating(0);

      if (currentIndex < questions.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        setVisible(false);
      }
    }, 800);
  }, [currentQ, answer, rating, state, currentIndex, questions.length]);

  const skip = useCallback(() => {
    // Mark as answered so it doesn't show again
    if (currentQ) {
      const newState = {
        ...state,
        answered: [...state.answered, currentQ.id],
      };
      setState(newState);
      saveSurveyState(newState);
    }

    setAnswer("");
    setRating(0);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setVisible(false);
    }
  }, [currentQ, state, currentIndex, questions.length]);

  const dismiss = useCallback(() => {
    const newState = { dismissed: true, answered: state.answered };
    setState(newState);
    saveSurveyState(newState);
    setVisible(false);
  }, [state.answered]);

  if (!visible || !currentQ) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Quick Survey</h3>
              <p className="text-[10px] text-muted">
                Help us improve — {currentIndex + 1} of {questions.length}
              </p>
            </div>
            <button
              onClick={dismiss}
              className="rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-card-hover transition-colors"
              title="Dismiss forever"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Question */}
          <div className="p-4 space-y-4">
            {submitted ? (
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="flex flex-col items-center py-6 gap-2"
              >
                <div className="text-2xl">✓</div>
                <p className="text-sm font-medium text-green">Recorded!</p>
              </motion.div>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground leading-relaxed">
                  {currentQ.question}
                </p>

                {/* Multiple choice */}
                {currentQ.type === "multiple_choice" && currentQ.options && (
                  <div className="space-y-2">
                    {currentQ.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setAnswer(opt)}
                        className={cn(
                          "w-full rounded-xl border px-4 py-2.5 text-left text-sm transition-all active:scale-[0.98]",
                          answer === opt
                            ? "border-accent bg-accent/10 text-accent font-medium"
                            : "border-border bg-card-hover/50 text-foreground hover:border-accent/30"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Text input */}
                {currentQ.type === "text" && (
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    maxLength={1000}
                    rows={3}
                    className="w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                )}

                {/* Rating (1-5 stars) */}
                {currentQ.type === "rating" && (
                  <div className="flex items-center justify-center gap-2 py-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setRating(n)}
                        className="transition-transform hover:scale-110 active:scale-95"
                      >
                        <Star
                          className={cn(
                            "h-8 w-8 transition-colors",
                            n <= rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted/40 hover:text-amber-400/60"
                          )}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          {!submitted && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <button
                onClick={skip}
                className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
              >
                <SkipForward className="h-3 w-3" />
                Skip
              </button>
              <button
                onClick={submitAnswer}
                disabled={
                  currentQ.type === "rating"
                    ? rating === 0
                    : !answer.trim()
                }
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all active:scale-95",
                  "bg-accent text-white shadow-md shadow-accent/25",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                {currentIndex < questions.length - 1 ? "Next" : "Submit"}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
