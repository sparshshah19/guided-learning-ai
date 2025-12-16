import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

const buildFallbackResponse = (prompt) => {
  const excerpt = prompt?.slice(0, 180) || 'your notes and question'
  return `Let's think about this together. You mentioned "${excerpt}". What part feels most unclear or worth breaking down next?`
}

const createGeminiHandler = () => async (req, res) => {
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
      const { prompt = '' } = body ? JSON.parse(body) : {}
      const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY
      let reply = buildFallbackResponse(prompt)

      if (apiKey && prompt) {
        try {
          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            },
          )

          if (geminiResponse.ok) {
            const data = await geminiResponse.json()
            const candidate = data?.candidates?.[0]?.content?.parts
              ?.map((part) => part.text)
              .join(' ')
            if (candidate) {
              reply = candidate
            }
          }
        } catch (error) {
          console.warn('Falling back to local response:', error.message)
        }
      }

      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ reply }))
    } catch (error) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Invalid JSON body' }))
    }
  })
}

const geminiPlugin = {
  name: 'local-gemini-route',
  configureServer(server) {
    server.middlewares.use('/api/gemini', createGeminiHandler())
  },
  configurePreviewServer(server) {
    server.middlewares.use('/api/gemini', createGeminiHandler())
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), geminiPlugin],
})
