import dotenv from "dotenv";
dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "models/gemini-flash-latest"
});

export async function askGemini(prompt) {
  const result = await model.generateContent(prompt);
  return result.response.text();
}
