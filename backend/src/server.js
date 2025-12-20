import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";
import { askGemini } from "./geminiClient.js";


dotenv.config();

console.log("KEY EXISTS?", !!process.env.GEMINI_API_KEY);
//  Load env once (works when you run `npm run dev` from backend/)


/// dotenv.config({ path: path.resolve(process.cwd(), ".env") }); ///
console.log("CWD:", process.cwd());
console.log("ENV PATH USED:", path.resolve(process.cwd(), ".env"));
console.log("Key starts with:", (process.env.GEMINI_API_KEY || "").slice(0, 6));
console.log(" GEMINI key loaded?", !!process.env.GEMINI_API_KEY);
console.log("Key length:", (process.env.GEMINI_API_KEY || "").length);

const app = express();
app.use(cors());
app.use(express.json());

// Basic routes
app.get("/", (req, res) => {
  res.send("Backend is running  Try /health or POST /api/ask");
});
app.get("/health", (req, res) => res.json({ ok: true }));

// In-memory sessions
const sessions = new Map();

function safeJsonParse(text) {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeQuestion(q) {
  return (q || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildGuidingPrompt(history, questionsAsked, askedSet) {
  const transcript = history
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const alreadyAsked =
    Array.from(askedSet).map((q) => `- ${q}`).join("\n") || "(none)";

  return `
You are a tutor. You MUST ask exactly ONE guiding question.
Rules:
- Do NOT give the final answer.
- Do NOT give multiple questions.
- Keep it short and specific.
- Do NOT repeat a previous question.
- Your goal is to ask question #${questionsAsked + 1} of 3.

Previous questions asked:
${alreadyAsked}

Return ONLY valid JSON like:
{"type":"question","text":"...one question..."}.

Transcript so far:
${transcript}
`;
}

function buildFinalPrompt(history) {
  const transcript = history
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  return `
You are a tutor. The student has answered 3 guiding questions.
Now give the final answer clearly, with a short explanation.

Return ONLY valid JSON like:
{"type":"final","answer":"...","explanation":"..."}.

Transcript:
${transcript}
`;
}

// Reset endpoint (optional)
app.post("/api/reset", (req, res) => {
  const { sessionId } = req.body || {};
  if (sessionId && sessions.has(sessionId)) sessions.delete(sessionId);
  return res.json({ ok: true });
});

app.post("/api/ask", async (req, res) => {
  try {
    const { sessionId, message } = req.body || {};

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "Gemini failed",
        message: "GEMINI_API_KEY not loaded on server",
      });
    }

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Bad request",
        message: "Expected JSON body: { message: string, sessionId?: string }",
      });
    }

    const id =
      sessionId && typeof sessionId === "string"
        ? sessionId
        : crypto.randomUUID();

    if (!sessions.has(id)) {
      sessions.set(id, { history: [], questionsAsked: 0, askedSet: new Set() });
    }

    const session = sessions.get(id);

    // Store user message
    session.history.push({ role: "user", content: message });

    // Build prompt for Gemini
    const llmPrompt =
      session.questionsAsked < 3
        ? buildGuidingPrompt(
            session.history,
            session.questionsAsked,
            session.askedSet
          )
        : buildFinalPrompt(session.history);

    // Helpful debug (won’t leak secrets)
    console.log("Prompt length:", llmPrompt.length);

    const raw = await askGemini(llmPrompt);
    const parsed = safeJsonParse(raw);

    const pickFallback = () =>
      [
        "What is the exact goal you’re trying to achieve?",
        "What have you tried so far, and what happened?",
        "What part feels most confusing right now?",
      ][session.questionsAsked] || "What detail would unlock the solution?";

    // If Gemini returns non-JSON, fall back safely
    if (!parsed) {
      if (session.questionsAsked < 3) {
        const fallback = pickFallback();
        session.questionsAsked += 1;
        session.askedSet.add(normalizeQuestion(fallback));
        session.history.push({ role: "assistant", content: fallback });

        return res.json({
          sessionId: id,
          type: "question",
          text: fallback,
          questionsAsked: session.questionsAsked,
        });
      }

      // After 3 questions, treat raw as final
      session.history.push({ role: "assistant", content: raw });
      return res.json({
        sessionId: id,
        type: "final",
        answer: raw,
        explanation: "",
      });
    }

    // Question response path
    if (parsed.type === "question") {
      const qText = (parsed.text || "").trim();
      const key = normalizeQuestion(qText);

      if (!qText || session.askedSet.has(key)) {
        const fallback = pickFallback();
        session.questionsAsked += 1;
        session.askedSet.add(normalizeQuestion(fallback));
        session.history.push({ role: "assistant", content: fallback });

        return res.json({
          sessionId: id,
          type: "question",
          text: fallback,
          questionsAsked: session.questionsAsked,
        });
      }

      session.questionsAsked += 1;
      session.askedSet.add(key);
      session.history.push({ role: "assistant", content: qText });

      return res.json({
        sessionId: id,
        type: "question",
        text: qText,
        questionsAsked: session.questionsAsked,
      });
    }

    // Final response path (default)
    session.history.push({
      role: "assistant",
      content: parsed.answer || "",
    });

    return res.json({
      sessionId: id,
      type: "final",
      answer: parsed.answer || "",
      explanation: parsed.explanation || "",
    });
  } catch (err) {
    console.error("🔥 Gemini error FULL:", err);
    return res.status(500).json({
      error: "Gemini failed",
      message: err?.message || String(err),
      // Helpful if SDK provides these
      status: err?.status,
      statusText: err?.statusText,
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
