import { useEffect, useMemo, useState } from "react";
import "./App.css";

const formatWordCount = (text) =>
  text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const summarizeText = (text, limit = 160) => {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.length <= limit ? trimmed : `${trimmed.slice(0, limit)}…`;
};

function App() {
  const [step, setStep] = useState(1);
  const [topic, setTopic] = useState("");
  const [brainDump, setBrainDump] = useState("");
  const [attempt, setAttempt] = useState("");
  const [question, setQuestion] = useState("");

  const [messages, setMessages] = useState([]); // [{sender:'ai'|'user', text:string}]
  const [userMessage, setUserMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState("");

  // ✅ sessionId is the key to “3 unique questions then final”
  const [sessionId, setSessionId] = useState(null);
  const [questionsAsked, setQuestionsAsked] = useState(0);

  const wordCount = useMemo(() => formatWordCount(brainDump), [brainDump]);
  const canUnlockQuestion = wordCount >= 30;
  const questionChars = question.length;
  const needsMoreDetail = questionChars < 200;

  useEffect(() => {
    setError("");
  }, [step]);


  // --- API ---
  const callAskRoute = async ({ sessionId, message }) => {
    console.log("SENDING TO BACKEND:", { sessionId, message });
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText} — ` +
          (data.error || JSON.stringify(data))
  );
}
    return data;
  };

  const appendAIMessageFromResponse = (data) => {
    // Always keep sessionId if backend returned one
    if (data.sessionId && !sessionId) setSessionId(data.sessionId);
    if (typeof data.questionsAsked === "number") setQuestionsAsked(data.questionsAsked);

    if (data.type === "question") {
      setMessages((prev) => [...prev, { sender: "ai", text: data.text }]);
      return;
    }

    if (data.type === "final") {
      const finalText = [data.answer, data.explanation].filter(Boolean).join("\n\n");
      setMessages((prev) => [...prev, { sender: "ai", text: finalText }]);
      return;
    }

    // fallback if response shape differs
    if (data.text) {
      setMessages((prev) => [...prev, { sender: "ai", text: data.text }]);
    }
  };

  const handleUnlockQuestion = () => {
    if (!canUnlockQuestion) return;
    setStep(2);
  };

  // Step 2 -> Step 3: start the guided flow
  const handleOpenChat = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;

    // reset session each time you start a new chat from step 2
    setSessionId(null);
    setQuestionsAsked(0);

    setStep(3);
    setMessages([]);
    setIsThinking(true);
    setError("");

    const firstMessage = `${topic ? `Topic: ${topic}\n\n` : ""}${brainDump}\n\nWhat I've tried:\n${attempt}\n\nMy question:\n${trimmedQuestion}`;

    try {
      const data = await callAskRoute({ sessionId: null, message: firstMessage });
      // store sessionId immediately if provided
      if (data.sessionId) setSessionId(data.sessionId);
      if (typeof data.questionsAsked === "number") setQuestionsAsked(data.questionsAsked);

      // first AI message
      if (data.type === "question") {
        setMessages([{ sender: "ai", text: data.text }]);
      } else if (data.type === "final") {
        const finalText = [data.answer, data.explanation].filter(Boolean).join("\n\n");
        setMessages([{ sender: "ai", text: finalText }]);
      } else if (data.text) {
        setMessages([{ sender: "ai", text: data.text }]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsThinking(false);
    }
  };

  const sendFollowUp = async () => {
    const trimmed = userMessage.trim();
    if (!trimmed) return;

    // add user message locally
    setMessages((prev) => [...prev, { sender: "user", text: trimmed }]);
    setUserMessage("");
    setIsThinking(true);
    setError("");

    try {
      const data = await callAskRoute({ sessionId, message: trimmed });

      // backend may return sessionId on first reply
      if (data.sessionId && !sessionId) setSessionId(data.sessionId);
      if (typeof data.questionsAsked === "number") setQuestionsAsked(data.questionsAsked);

      appendAIMessageFromResponse(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsThinking(false);
    }
  };

  const renderBrainDump = () => {
    const wordsNeeded = Math.max(0, 30 - wordCount);

    return (
      <div className="stage stage--brain">
        <div className="stage__accent">
          <div className="logo-title stage__logo">
            <div className="dot" />
            <div>
              <p className="eyebrow eyebrow--light">Guided Thinking</p>
              <span className="brand brand--hero">Think First</span>
            </div>
          </div>
          <div className="pill">Step 1 · Brain dump</div>
          <h1>Prime your brain before asking for help.</h1>
          <p className="subtitle">
            Spread everything you already know across the page. A fuller brain dump leads to sharper AI coaching.
          </p>
          <div className="stat-card">
            <p className="stat-label">Word progress</p>
            <h2>{wordCount} / 30</h2>
            <p className="muted">
              {wordsNeeded
                ? `${wordsNeeded} more word${wordsNeeded === 1 ? "" : "s"} needed to unlock the next step`
                : "Ready for step two"}
            </p>
          </div>
        </div>

        <div className="stage__form">
          <label className="label" htmlFor="topic">
            What topic are you studying?
          </label>
          <input
            id="topic"
            className="input"
            placeholder="e.g., Photosynthesis, World War II, Calculus..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />

          <label className="label" htmlFor="dump">
            Write everything you know
          </label>
          <p className="hint">
            Start typing what you already know about this topic. Include facts, concepts, connections, questions you have...
          </p>
          <textarea
            id="dump"
            className="textarea"
            rows={10}
            value={brainDump}
            onChange={(e) => setBrainDump(e.target.value)}
            placeholder="Write at least 30 words before continuing"
          />

          <div className="progress-row">
            <span className="muted">{wordCount} / 30 words</span>
            <span className="muted">
              {wordsNeeded ? `${wordsNeeded} more word${wordsNeeded === 1 ? "" : "s"} needed` : "Nice! Move on when ready."}
            </span>
          </div>

          <button type="button" className="primary" disabled={!canUnlockQuestion} onClick={handleUnlockQuestion}>
            Keep writing to unlock
          </button>
        </div>
      </div>
    );
  };

  const renderQuestion = () => (
    <div className="stage stage--question">
      <div className="stage__accent stage__accent--question">
        <div className="logo-title stage__logo">
          <div className="dot" />
          <div>
            <p className="eyebrow eyebrow--light">Guided Thinking</p>
            <span className="brand brand--hero">Sharpen it</span>
          </div>
        </div>
        <div className="pill">Step 2 · Pinpoint confusion</div>
        <h1>Zoom in on the part that still feels fuzzy.</h1>
        <p className="subtitle">The clearer your question, the more targeted the AI coach can be.</p>

        <div className="stat-card">
          <p className="stat-label">Topic</p>
          <h2>{topic || "Untitled topic"}</h2>
          <p className="muted">{wordCount} words captured so far</p>
        </div>

        <div className="summary-card">
          <p className="stat-label">Brain dump highlight</p>
          <p>{brainDump ? summarizeText(brainDump) : "Your notes from step one will show up here so you can keep context handy."}</p>
        </div>

        <div className="summary-card">
          <p className="stat-label">Attempt snapshot</p>
          <p>{attempt ? summarizeText(attempt) : "After writing your question, jot down what you already tried so the coach can build on it."}</p>
        </div>
      </div>

      <div className="stage__form">
        <div className="form-row">
          <button className="ghost" type="button" onClick={() => setStep(1)}>
            ← Back
          </button>
          <span className="pill pill--subtle">{needsMoreDetail ? "Aim for ~200 characters" : "Looks clear!"}</span>
        </div>

        <label className="label" htmlFor="question">
          What specifically confuses you?
        </label>
        <p className="hint">
          Be specific. Instead of "I don't understand photosynthesis", try "Why does the light reaction only happen in thylakoids?"
        </p>
        <textarea
          id="question"
          className="textarea"
          rows={8}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Write a focused question for the AI guide"
        />

        <label className="label" htmlFor="attempt">
          What have you already tried?
        </label>
        <p className="hint">Describe your current approach or what you already attempted.</p>
        <textarea
          id="attempt"
          className="textarea"
          rows={6}
          value={attempt}
          onChange={(e) => setAttempt(e.target.value)}
          placeholder="Walk through the steps you took so far…"
        />

        <div className="progress-row">
          <span className="muted">{questionChars} characters</span>
          <span className="muted">{needsMoreDetail ? "Add more detail for a sharper response" : "Great! Ready for the AI guide."}</span>
        </div>

        <button type="button" className="primary" onClick={handleOpenChat}>
          Start guided chat
        </button>
      </div>
    </div>
  );

  const renderChat = () => (
    <div className="stage stage--chat">
      <div className="stage__accent stage__accent--chat">
        <div className="logo-title stage__logo">
          <div className="dot" />
          <div>
            <p className="eyebrow eyebrow--light">Guided Thinking</p>
            <span className="brand brand--hero">Study Coach</span>
          </div>
        </div>
        <div className="pill">Step 3 · Guided conversation</div>
        <h1>Work the problem with your coach.</h1>
        <p className="subtitle">Share your thinking, challenge your assumptions, and let the AI prompt you toward clarity.</p>

        <div className="question-card">
          <p className="stat-label">Your question</p>
          <p className="question-card__text">{question || "No question yet."}</p>
        </div>

        <div className="summary-card summary-card--dark">
          <p className="stat-label">Topic</p>
          <p className="summary-card__value">{topic || "Untitled topic"}</p>
          <p className="stat-label">Brain dump</p>
          <p className="summary-card__text">{brainDump ? summarizeText(brainDump, 120) : "Complete the earlier steps to give the AI context."}</p>
          <p className="stat-label">Attempt</p>
          <p className="summary-card__text">{attempt ? summarizeText(attempt, 120) : "Describe what you already tried to unlock sharper coaching."}</p>
        </div>
      </div>

      <div className="stage__form stage__form--chat">
        <header className="chat__header">
          <div>
            <p className="eyebrow">Guided Thinking</p>
            <h2 className="chat__topic">{topic || "No topic yet"}</h2>
          </div>
          <div className="streak">🔥 {questionsAsked} / 3</div>
        </header>

        <main className="chat__body">
          <div className="bubble bubble--prompt">
            <p className="prompt-label">Your question</p>
            <p className="prompt-text">{question || "No question yet."}</p>
          </div>

          {messages.map((message, index) => (
            <div
              key={`${message.sender}-${index}`}
              className={`bubble ${message.sender === "ai" ? "bubble--ai" : "bubble--user"}`}
            >
              <p>{message.text}</p>
            </div>
          ))}

          {isThinking && <p className="muted">AI guide is thinking...</p>}
          {error && <p className="error">{error}</p>}
        </main>

        <footer className="chat__footer">
          <div className="muted">Think through your answer…</div>
          <div className="muted">
            {questionsAsked < 3 ? `${3 - questionsAsked} more question(s) until final answer` : "Final answer should arrive next"}
          </div>
          <div className="input-row">
            <input
              className="input"
              placeholder="Share your thinking here"
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendFollowUp()}
            />
            <button className="send" onClick={sendFollowUp} disabled={isThinking}>
              ➤
            </button>
          </div>
        </footer>
      </div>
    </div>
  );

  return (
    <div className="app">
      {step === 1 && renderBrainDump()}
      {step === 2 && renderQuestion()}
      {step === 3 && renderChat()}
    </div>
  );
}

export default App;
