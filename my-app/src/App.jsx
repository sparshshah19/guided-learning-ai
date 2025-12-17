import { useMemo, useState } from 'react'
import './App.css'

const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length

function App() {
  const [step, setStep] = useState(1)
  const [topic, setTopic] = useState('')
  const [brainDump, setBrainDump] = useState('')
  const [question, setQuestion] = useState('')
  const [chatNotes, setChatNotes] = useState('')

  const wordCount = useMemo(() => countWords(brainDump), [brainDump])
  const canUnlockQuestion = wordCount >= 30

  const handleUnlockQuestion = () => {
    if (canUnlockQuestion) {
      setStep(2)
    }
  }

  const handleOpenChat = () => {
    if (question.trim()) {
      setStep(3)
    }
  }

  const renderStepOne = () => (
    <div className="panel">
      <h1>Step 1: Brain dump</h1>
      <p>Write at least 30 words about what you already know. This unlocks the next step.</p>

      <label className="label" htmlFor="topic">
        Topic
      </label>
      <input
        id="topic"
        className="input"
        placeholder="e.g., Photosynthesis, World War II, Calculus"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
      />

      <label className="label" htmlFor="brainDump">
        Everything you know
      </label>
      <textarea
        id="brainDump"
        className="textarea"
        rows={8}
        placeholder="Type what you know here"
        value={brainDump}
        onChange={(e) => setBrainDump(e.target.value)}
      />

      <div className="helper-row">
        <span>{wordCount} / 30 words</span>
        <span>{Math.max(0, 30 - wordCount)} more to go</span>
      </div>

      <button className="primary" onClick={handleUnlockQuestion} disabled={!canUnlockQuestion}>
        Keep writing to unlock
      </button>
    </div>
  )

  const renderStepTwo = () => (
    <div className="panel">
      <div className="panel__header">
        <button className="link" onClick={() => setStep(1)}>
          ← Back to brain dump
        </button>
      </div>

      <h1>Step 2: Sharpen your question</h1>
      <p>Use your notes to form a precise question. You can always go back and edit.</p>

      <label className="label" htmlFor="question">
        What specifically confuses you about {topic || 'this topic'}?
      </label>
      <textarea
        id="question"
        className="textarea"
        rows={6}
        placeholder="Write your focused question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />

      <button className="primary" onClick={handleOpenChat} disabled={!question.trim()}>
        Add more detail to your question
      </button>
    </div>
  )

  const renderStepThree = () => (
    <div className="panel">
      <div className="panel__header">
        <button className="link" onClick={() => setStep(2)}>
          ← Back to question
        </button>
      </div>

      <h1>Step 3: Practice explaining</h1>
      <p>
        Imagine a mentor is asking follow-ups. Use this space to jot your answers and identify what to look up
        next. No API calls are made here—this is a simple reflection spot.
      </p>

      <div className="summary">
        <p className="summary__label">Topic</p>
        <p className="summary__value">{topic || 'Not set yet'}</p>
        <p className="summary__label">Your question</p>
        <p className="summary__value">{question || 'No question yet'}</p>
      </div>

      <label className="label" htmlFor="chatNotes">
        Continue writing
      </label>
      <textarea
        id="chatNotes"
        className="textarea"
        rows={8}
        placeholder="Draft your own guidance or next steps here"
        value={chatNotes}
        onChange={(e) => setChatNotes(e.target.value)}
      />
    </div>
  )

  return (
    <main className="app">
      {step === 1 && renderStepOne()}
      {step === 2 && renderStepTwo()}
      {step === 3 && renderStepThree()}
    </main>
  )
}

export default App
