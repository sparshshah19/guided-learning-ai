import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { askGemini } from "./geminiClient.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/api/ask", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const text = await askGemini(prompt);
    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: "Gemini call failed" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
