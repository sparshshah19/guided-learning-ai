import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { askGemini } from "./geminiClient.js";
import crypto from "crypto";

dotenv.config();

// for learning apis this creates the server
const app = express();
// tells the frontend to talk to the backend
app.use(cors());
//allows the conversion to JSON
app.use(express.json());

// (optional) makes clicking the link not show "Cannot GET /"
app.get("/", (req, res) => {
  res.send("Backend is running ✅ Try /health or POST /api/ask");
});

//tests the endpoint
app.get("/health", (req, res) => res.json({ ok: true }));

//in-mem sessions
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

// Reset endpoint (optional, but lifesaver during dev)
app.post("/api/reset", (req, res) => {
  const { sessionId } = req.body || {};
  if (sessionId && sessions.has(sessionId)) sessions.delete(sessionId);
  return res.json({ ok: true });
});

app.post("/api/ask", async (req, res) => {
  try {
    console.log("REQ BODY:", req.body);
    const { sessionId, message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing message" });
    }

    const id =
      sessionId && typeof sessionId === "string"
        ? sessionId
        : crypto.randomUUID();

    if (!sessions.has(id)) {
      sessions.set(id, { history: [], questionsAsked: 0, askedSet: new Set() });
    }

    const session = sessions.get(id);

    // store user message
    session.history.push({ role: "user", content: message });

    // build prompt
    const llmPrompt =
      session.questionsAsked < 3
        ? buildGuidingPrompt(session.history, session.questionsAsked, session.askedSet)
        : buildFinalPrompt(session.history);

    const raw = await askGemini(llmPrompt);
    const parsed = safeJsonParse(raw);

    // helper to rotate fallback questions (prevents loops)
    const pickFallback = () =>
      [
        "What is the exact goal you’re trying to achieve (one sentence)?",
        "What have you tried so far, and what happened?",
        "What part feels most confusing right now?",
      ][session.questionsAsked] || "What detail would unlock the solution?";

    // Fallback if Gemini returns non-JSON
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

      // after 3, treat raw as final
      session.history.push({ role: "assistant", content: raw });
      return res.json({
        sessionId: id,
        type: "final",
        answer: raw,
        explanation: "",
      });
    }

    // question path
    if (parsed.type === "question") {
      const qText = (parsed.text || "").trim();
      const key = normalizeQuestion(qText);

      // If empty or repeated, force a different fallback question
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

    // if it wasn't "question", only accept "final"; otherwise fall back safely
    if (parsed.type !== "final") {
      session.history.push({ role: "assistant", content: raw });
      return res.json({
        sessionId: id,
        type: "final",
        answer: raw,
        explanation: "",
      });
    }

    // final
    session.history.push({ role: "assistant", content: parsed.answer || "" });
    return res.json({
      sessionId: id,
      type: "final",
      answer: parsed.answer || "",
      explanation: parsed.explanation || "",
    });
    } catch (e) {
    console.error("API /api/ask failed:", e);
    return res.status(500).json({
      error: "Gemini failed",
      details: String(e?.message || e),
    });
  }
}); // ✅ close the route

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`Backend running on http://localhost:${PORT}`)
);
