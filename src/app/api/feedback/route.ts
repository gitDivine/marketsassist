import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";

interface FeedbackEntry {
  id: string;
  text: string;
  images: string[];
  createdAt: string;
  userAgent: string;
  page: string;
}

const MAX_TEXT_LENGTH = 2000;
const MAX_IMAGE_SIZE = 500 * 1024;
const FEEDBACK_KEY = "feedback:entries";
const MAX_ENTRIES = 500;

// Lazy Redis connection
let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || "", {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      connectTimeout: 5000,
    });
  }
  return redis;
}

// POST — submit feedback
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, images, page } = body as {
      text?: string;
      images?: string[];
      page?: string;
    };

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Feedback text is required." }, { status: 400 });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: `Text must be under ${MAX_TEXT_LENGTH} characters.` }, { status: 400 });
    }

    const validImages: string[] = [];
    if (Array.isArray(images)) {
      for (const img of images.slice(0, 5)) {
        if (typeof img !== "string") continue;
        const sizeEstimate = Math.ceil((img.length * 3) / 4);
        if (sizeEstimate > MAX_IMAGE_SIZE) {
          return NextResponse.json({ error: "Each image must be under 500KB." }, { status: 400 });
        }
        validImages.push(img);
      }
    }

    const entry: FeedbackEntry = {
      id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: text.trim(),
      images: validImages,
      createdAt: new Date().toISOString(),
      userAgent: (req.headers.get("user-agent") || "unknown").slice(0, 200),
      page: typeof page === "string" ? page : "/",
    };

    const r = getRedis();
    // Push to front of list
    await r.lpush(FEEDBACK_KEY, JSON.stringify(entry));
    // Trim to max entries
    await r.ltrim(FEEDBACK_KEY, 0, MAX_ENTRIES - 1);

    return NextResponse.json({ success: true, id: entry.id }, { status: 201 });
  } catch (err) {
    console.error("Feedback POST error:", err);
    return NextResponse.json({ error: "Failed to save feedback." }, { status: 500 });
  }
}

// GET — read feedback
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    const r = getRedis();

    // Delete oldest 100
    if (action === "delete_oldest_100") {
      const len = await r.llen(FEEDBACK_KEY);
      if (len > 100) {
        await r.ltrim(FEEDBACK_KEY, 0, len - 101);
      } else {
        await r.del(FEEDBACK_KEY);
      }
      return NextResponse.json({ success: true, deleted: Math.min(len, 100) });
    }

    // Auto-cleanup: delete entries older than 7 days
    if (action === "auto_cleanup") {
      const all = await r.lrange(FEEDBACK_KEY, 0, -1);
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const keep: string[] = [];
      let removed = 0;

      for (const raw of all) {
        try {
          const entry: FeedbackEntry = JSON.parse(raw);
          if (new Date(entry.createdAt).getTime() >= sevenDaysAgo) {
            keep.push(raw);
          } else {
            removed++;
          }
        } catch {
          removed++;
        }
      }

      if (removed > 0) {
        const pipeline = r.pipeline();
        pipeline.del(FEEDBACK_KEY);
        for (const item of keep) {
          pipeline.rpush(FEEDBACK_KEY, item);
        }
        await pipeline.exec();
      }

      return NextResponse.json({ success: true, removed, remaining: keep.length });
    }

    // Default: return all feedback (newest first)
    const raw = await r.lrange(FEEDBACK_KEY, 0, MAX_ENTRIES - 1);
    const feedback: FeedbackEntry[] = raw.map((r) => {
      try { return JSON.parse(r); } catch { return null; }
    }).filter(Boolean);

    return NextResponse.json({ feedback });
  } catch (err) {
    console.error("Feedback GET error:", err);
    return NextResponse.json({ feedback: [], error: "Failed to load feedback." }, { status: 500 });
  }
}
