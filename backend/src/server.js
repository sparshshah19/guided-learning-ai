import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { askGemini } from "./geminiClient.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// homepage so clicking localhost works
app.get("/", (req, res) => {
  res.send("Backend is running ✅ Try /health or POST /api/ask");
});

// health check
app.get("/health", (req, res) => res.json({ ok: true }));

// Gemini endpoint
app.post("/api/ask", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing message" });
    }

    const text = await askGemini(message);
    return res.json({ text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gemini call failed" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

