import { useEffect, useMemo, useState } from 'react'
import './App.css'

const formatWordCount = (text) =>
  text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length

const callGeminiRoute = async (prompt) => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  })

  if (!response.ok) {
    throw new Error('Network error while contacting the AI guide')
  }

  const data = await response.json()
  return data.reply
}

function App() {
  const [step, setStep] = useState(1)
  const [topic, setTopic] = useState('')
  const [brainDump, setBrainDump] = useState('')
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [userMessage, setUserMessage] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [error, setError] = useState('')

  const wordCount = useMemo(() => formatWordCount(brainDump), [brainDump])
  const canUnlockQuestion = wordCount >= 30
  const questionChars = question.length
  const needsMoreDetail = questionChars < 200

  useEffect(() => {
    setError('')
  }, [step])

  const handleUnlockQuestion = () => {
    if (!canUnlockQuestion) return
    setStep(2)
  }

  const handleOpenChat = async () => {
    setStep(3)
    if (!question.trim()) return

    const initialUserMessage = {
      sender: 'user',
      text: question.trim(),
    }
    setMessages([initialUserMessage])
    setIsThinking(true)
    setError('')

    try {
      const reply = await callGeminiRoute(
        `The learner is studying "${topic || 'an unspecified topic'}". They wrote this brain dump: ${
          brainDump || 'No notes provided yet.'
        }. Their question is: ${question}. Respond with a concise guiding question to help them think further.`,
      )
      setMessages((prev) => [...prev, { sender: 'ai', text: reply }])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsThinking(false)
    }
  }

  const sendFollowUp = async () => {
    if (!userMessage.trim()) return

    const trimmed = userMessage.trim()
    setMessages((prev) => [...prev, { sender: 'user', text: trimmed }])
    setUserMessage('')
    setIsThinking(true)
    setError('')

    try {
      const reply = await callGeminiRoute(
        `Continue the guided study conversation. Learner topic: ${
          topic || 'unknown'
        }. Brain dump: ${brainDump}. Current question: ${question}. Learner just said: ${trimmed}. Encourage them with a probing question and keep answers concise.`,
      )
      setMessages((prev) => [...prev, { sender: 'ai', text: reply }])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsThinking(false)
    }
  }

  const renderBrainDump = () => (
    <div className="panel">
      <header className="panel__header">
        <div className="logo-title">
          <div className="dot" />
          <span className="brand">Think First</span>
        </div>
        <button className="help">?</button>
      </header>

      <div className="panel__content">
        <p className="eyebrow">Brain Dump</p>
        <h1 className="title">Before AI can help, write everything you already know about your topic.</h1>
        <p className="subtitle">This activates your memory.</p>

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
          rows={8}
          value={brainDump}
          onChange={(e) => setBrainDump(e.target.value)}
          placeholder="Write at least 30 words before continuing"
        />

        <div className="progress-row">
          <span className="muted">{wordCount} / 30 words</span>
          <span className="muted">{Math.max(0, 30 - wordCount)} more words needed</span>
        </div>

        <button
          type="button"
          className="primary"
          disabled={!canUnlockQuestion}
          onClick={handleUnlockQuestion}
        >
          Keep writing to unlock
        </button>
      </div>
    </div>
  )

  const renderQuestion = () => (
    <div className="panel">
      <header className="panel__header">
        <button className="back" onClick={() => setStep(1)}>
          ← Back
        </button>
        <div className="logo-title">
          <div className="dot" />
          <span className="brand">Think First</span>
        </div>
        <button className="help">?</button>
      </header>

      <div className="panel__content">
        <p className="eyebrow">Your Question</p>
        <h1 className="title">
          What specifically confuses you about {topic || 'this topic'}? Be precise.
        </h1>

        <label className="label" htmlFor="brain-dump">
          Your brain dump
        </label>
        <select id="brain-dump" className="input" value={brainDump} onChange={(e) => setBrainDump(e.target.value)}>
          <option value={brainDump || ''}>{brainDump || 'Copy from the previous step or write here'}</option>
        </select>

        <label className="label" htmlFor="question">
          What specifically confuses you?
        </label>
        <p className="hint">
          Be specific. Instead of "I don't understand photosynthesis", try "Why does the light reaction only happen in thylakoids?"
        </p>
        <textarea
          id="question"
          className="textarea"
          rows={6}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Write a focused question for the AI guide"
        />

        <div className="progress-row">
          <span className="muted">{questionChars} characters</span>
          <span className="muted">{needsMoreDetail ? 'Be more specific (200+ chars)' : 'Looks clear!'} </span>
        </div>

        <button type="button" className="primary" onClick={handleOpenChat}>
          Add more detail to your question
        </button>
      </div>
    </div>
  )

  const renderChat = () => (
    <div className="chat">
      <header className="chat__header">
        <div className="logo-title">
          <div className="dot" />
          <span className="brand">Guided Thinking</span>
        </div>
        <div className="status">{topic || 'No topic yet'}</div>
        <div className="streak">🔥 0 streak</div>
      </header>

      <main className="chat__body">
        <div className="bubble bubble--prompt">
          <p className="prompt-label">Your question</p>
          <p className="prompt-text">{question || 'No question yet.'}</p>
        </div>

        {messages.map((message, index) => (
          <div
            key={`${message.sender}-${index}`}
            className={`bubble ${message.sender === 'ai' ? 'bubble--ai' : 'bubble--user'}`}
          >
            <p>{message.text}</p>
          </div>
        ))}

        {isThinking && <p className="muted">AI guide is thinking...</p>}
        {error && <p className="error">{error}</p>}
      </main>

      <footer className="chat__footer">
        <div className="muted">Think through your answer…</div>
        <div className="muted">3 more exchanges to unlock "I understand"</div>
        <div className="input-row">
          <input
            className="input"
            placeholder="Share your thinking here"
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendFollowUp()}
          />
          <button className="send" onClick={sendFollowUp} disabled={isThinking}>
            ➤
          </button>
        </div>
      </footer>
    </div>
  )

  return (
    <div className="app">
      {step === 1 && renderBrainDump()}
      {step === 2 && renderQuestion()}
      {step === 3 && renderChat()}
    </div>
  )
}

export default App
