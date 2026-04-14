"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MessageSquare,
  X,
  Upload,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_IMAGE_SIZE = 500 * 1024; // 500KB

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [images, setImages] = useState<{ data: string; name: string }[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setText("");
    setImages([]);
    setStatus("idle");
    setErrorMsg("");
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Reset after animation completes
    setTimeout(reset, 300);
  }, [reset]);

  // Auto-close on success
  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(handleClose, 2000);
      return () => clearTimeout(timer);
    }
  }, [status, handleClose]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (images.length >= 5) {
        setErrorMsg("Maximum 5 images allowed.");
        break;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setErrorMsg(`${file.name} is over 500KB — skipped.`);
        continue;
      }
      if (!file.type.startsWith("image/")) {
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => {
          if (prev.length >= 5) return prev;
          return [...prev, { data: reader.result as string, name: file.name }];
        });
        setErrorMsg("");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          images: images.length > 0 ? images.map((i) => i.data) : undefined,
          page: typeof window !== "undefined" ? window.location.pathname : "/",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit feedback.");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full px-4 py-2.5",
          "bg-card border border-border text-foreground shadow-lg",
          "hover:bg-accent transition-colors duration-200",
          "text-sm font-medium"
        )}
      >
        <MessageSquare className="h-4 w-4" />
        <span>Give Feedback</span>
      </button>

      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none md:pointer-events-none"
            onClick={handleClose}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            // Mobile: slide up from bottom. Desktop: appear above button.
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={cn(
              "fixed z-50",
              // Mobile: full-width bottom sheet
              "inset-x-0 bottom-0 mx-auto max-h-[85vh]",
              // Desktop: positioned above button
              "md:inset-x-auto md:bottom-16 md:left-4 md:w-[380px] md:max-h-[520px]",
              "rounded-t-2xl md:rounded-2xl",
              "bg-card border border-border shadow-2xl",
              "flex flex-col overflow-hidden"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-4 pb-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Your opinion helps shape our site
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tell us what you think — suggestions, bugs, ideas, anything.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1 -mt-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
              {status === "success" ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center justify-center py-10 gap-3"
                >
                  <div className="rounded-full bg-emerald-500/20 p-3">
                    <Check className="h-6 w-6 text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Thanks! Your feedback has been received.
                  </p>
                </motion.div>
              ) : (
                <>
                  {/* Textarea */}
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="What's on your mind?"
                    maxLength={2000}
                    rows={4}
                    className={cn(
                      "w-full rounded-lg bg-background border border-border p-3",
                      "text-sm text-foreground placeholder:text-muted-foreground",
                      "resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    )}
                  />

                  {/* Character count */}
                  <div className="text-xs text-muted-foreground text-right -mt-1">
                    {text.length}/2000
                  </div>

                  {/* Image upload */}
                  {images.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {images.map((img, i) => (
                        <div key={i} className="relative inline-block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.data}
                            alt={`Upload ${i + 1}`}
                            className="h-16 w-16 rounded-lg object-cover border border-border"
                          />
                          <button
                            onClick={() => {
                              setImages((prev) => prev.filter((_, j) => j !== i));
                              if (fileRef.current) fileRef.current.value = "";
                            }}
                            className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {images.length < 5 && (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className={cn(
                        "flex items-center gap-2 text-xs text-muted-foreground",
                        "hover:text-foreground transition-colors"
                      )}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {images.length === 0 ? "Attach screenshots (optional, max 5)" : `Add more (${images.length}/5)`}
                    </button>
                  )}

                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                  />

                  {/* Error message */}
                  {errorMsg && (
                    <p className="text-xs text-destructive">{errorMsg}</p>
                  )}

                  {/* Submit */}
                  <button
                    onClick={handleSubmit}
                    disabled={!text.trim() || status === "loading"}
                    className={cn(
                      "w-full rounded-lg py-2.5 text-sm font-medium transition-colors",
                      "bg-primary text-primary-foreground",
                      "hover:bg-primary/90",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "flex items-center justify-center gap-2"
                    )}
                  >
                    {status === "loading" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      "Submit Feedback"
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground text-center">
                Not financial advice
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
