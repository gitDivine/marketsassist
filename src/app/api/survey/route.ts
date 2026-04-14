import { NextRequest, NextResponse } from "next/server";

export interface SurveyQuestion {
  id: string;
  type: "multiple_choice" | "text" | "rating";
  question: string;
  options?: string[]; // for multiple_choice
  required: boolean;
  createdAt: string;
}

export interface SurveyResponse {
  id: string;
  questionId: string;
  answer: string;
  createdAt: string;
  userAgent: string;
}

// In-memory store (persists during serverless lifecycle)
const questions: SurveyQuestion[] = [];
const responses: SurveyResponse[] = [];

// GET — return active questions + response counts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const admin = searchParams.get("admin");

  if (admin === "true") {
    // Admin view: return everything
    return NextResponse.json({
      questions,
      responses,
      stats: questions.map((q) => ({
        questionId: q.id,
        question: q.question,
        totalResponses: responses.filter((r) => r.questionId === q.id).length,
        answers: responses
          .filter((r) => r.questionId === q.id)
          .reduce((acc, r) => {
            acc[r.answer] = (acc[r.answer] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
      })),
    });
  }

  // User view: return questions only
  return NextResponse.json({ questions });
}

// POST — create question (admin) or submit response (user)
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Admin creating a question
  if (body.action === "create_question") {
    const { type, question, options, required } = body;

    if (!question || !type) {
      return NextResponse.json({ error: "Question and type required" }, { status: 400 });
    }

    if (type === "multiple_choice" && (!options || options.length < 2)) {
      return NextResponse.json({ error: "Multiple choice needs 2+ options" }, { status: 400 });
    }

    const q: SurveyQuestion = {
      id: `sq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      question: question.slice(0, 500),
      options: type === "multiple_choice" ? options.slice(0, 10) : undefined,
      required: !!required,
      createdAt: new Date().toISOString(),
    };

    questions.push(q);
    return NextResponse.json({ success: true, question: q });
  }

  // Admin deleting a question
  if (body.action === "delete_question") {
    const idx = questions.findIndex((q) => q.id === body.questionId);
    if (idx !== -1) questions.splice(idx, 1);
    return NextResponse.json({ success: true });
  }

  // User submitting a response
  if (body.action === "respond") {
    const { questionId, answer } = body;

    if (!questionId || answer === undefined) {
      return NextResponse.json({ error: "questionId and answer required" }, { status: 400 });
    }

    const r: SurveyResponse = {
      id: `sr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      questionId,
      answer: String(answer).slice(0, 1000),
      createdAt: new Date().toISOString(),
      userAgent: (req.headers.get("user-agent") || "Unknown").slice(0, 200),
    };

    responses.push(r);
    if (responses.length > 2000) responses.splice(0, responses.length - 2000);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
