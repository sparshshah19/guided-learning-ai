import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

const systemPrompt = `
You are a learning-first Socratic study coach.

RULES:
- Never provide the final answer or full solution.
- Only provide: (1) 3-6 guiding questions, (2) 2-4 hints, (3) a short "check yourself" list.
- You MUST avoid repeating any question in the "Previously asked questions" list below.
- Do not rephrase them either. If a similar question would help, ask a NEW angle.
- Use the student's brain dump + attempt to tailor your questions (reference their exact ideas).
- If the student seems stuck, break the problem into smaller sub-questions.

OUTPUT FORMAT (exact):
Guiding questions:
1) ...
2) ...
Hints:
- ...
- ...
Check yourself:
- ...
`

const buildFallbackResponse = ({ brainDump = '', attempt = '', userQuestion = '' }) => {
  const base = userQuestion || brainDump || attempt || 'your notes and question'
  const excerpt = base.slice(0, 180)
  return `Let's think about this together. You mentioned "${excerpt}". What part feels most unclear or worth breaking down next?`
}

const buildMemoryBlock = ({ brainDump, attempt, userQuestion, askedQuestions }) => `
Student brain dump:
${brainDump || 'None'}

Student attempt:
${attempt || 'None'}

Student's current question:
${userQuestion || 'Not provided'}

Previously asked questions (DO NOT repeat or paraphrase):
${askedQuestions.length ? askedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n') : 'None'}
`

const sanitizeHistory = (history) => {
  if (!Array.isArray(history)) {
    return []
  }

  return history
    .map((turn) => {
      const role = turn?.role === 'assistant' ? 'assistant' : 'user'
      const content = typeof turn?.content === 'string' ? turn.content : ''
      return { role, content: content.trim() }
    })
    .filter((turn) => Boolean(turn.content))
}

const buildMessages = ({ brainDump, attempt, userQuestion, history, askedQuestions }) => {
  const sanitized = sanitizeHistory(history).slice(-10)
  const messages = [
    { role: 'system', content: systemPrompt.trim() },
    {
      role: 'system',
      content: buildMemoryBlock({
        brainDump,
        attempt,
        userQuestion,
        askedQuestions,
      }).trim(),
    },
    ...sanitized,
  ]

  const finalUserQuestion = userQuestion?.trim()
    ? userQuestion.trim()
    : 'Please guide me based on my attempt and notes.'

  messages.push({ role: 'user', content: finalUserQuestion })
  return messages
}

const callOpenAI = async (messages, apiKey) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.4,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`)
  }

  const data = await response.json()
  return data?.choices?.[0]?.message?.content?.trim()
}

const formatMessagesForGemini = (messages) =>
  messages.map(({ role, content }) => `${role.toUpperCase()}: ${content}`).join('\n\n')

const callGemini = async (messages, apiKey) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: formatMessagesForGemini(messages) }] }],
      }),
    },
  )

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`)
  }

  const data = await response.json()
  const candidate = data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join(' ')
  return candidate?.trim()
}

const extractGuidingQuestions = (text) => {
  if (!text) return []
  const match = text.match(/Guiding questions:\s*([\s\S]*?)\nHints:/i)
  if (!match) return []

  return match[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\d+\)\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 8)
}

const createGuideHandler = () => async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  let body = ''
  req.on('data', (chunk) => {
    body += chunk
  })

  req.on('end', async () => {
    try {
      const parsed = body ? JSON.parse(body) : {}
      const {
        brainDump = '',
        attempt = '',
        userQuestion = '',
        history = [],
        askedQuestions: asked = [],
      } = parsed

      const askedQuestions = Array.isArray(asked) ? asked : []
      const payload = { brainDump, attempt, userQuestion, history, askedQuestions }
      const messages = buildMessages(payload)
      const fallback = buildFallbackResponse({ brainDump, attempt, userQuestion })
      const openaiKey = process.env.OPENAI_API_KEY
      const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY

      let reply = fallback

      if (openaiKey) {
        try {
          const openaiReply = await callOpenAI(messages, openaiKey)
          if (openaiReply) {
            reply = openaiReply
          }
        } catch (error) {
          console.warn('OpenAI error, checking Gemini fallback:', error.message)
        }
      }

      if (reply === fallback && geminiKey) {
        try {
          const geminiReply = await callGemini(messages, geminiKey)
          if (geminiReply) {
            reply = geminiReply
          }
        } catch (error) {
          console.warn('Gemini error, falling back to local response:', error.message)
        }
      }

      const extracted = extractGuidingQuestions(reply)
      const newQuestions = extracted.filter(
        (question) => question && !askedQuestions.includes(question),
      )

      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ reply, newQuestions }))
    } catch (error) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Invalid JSON body' }))
    }
  })
}

const guidePlugin = {
  name: 'local-guide-route',
  configureServer(server) {
    server.middlewares.use('/api/guide', createGuideHandler())
  },
  configurePreviewServer(server) {
    server.middlewares.use('/api/guide', createGuideHandler())
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), guidePlugin],
})
