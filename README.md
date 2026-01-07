**Watch The Demo Video: ** 

https://www.linkedin.com/feed/update/urn:li:activity:7408641721644773376/

**Overview**

Rather than immediately providing answers, the app guides users through a structured process that helps them externalize their understanding, refine their questions, and then engage in a guided AI conversation.

**Problem Being Solved**

Modern AI tools often optimize for speed and direct answers, which can reduce meaningful learning and critical thinking. Students frequently rely on AI-generated responses without fully engaging with the underlying concepts.

Guided Learning AI addresses this gap by introducing intentional friction before AI interaction, ensuring users actively think, reflect, and articulate their understanding.

**Solution**

The application enforces a three-step learning flow that prioritizes cognitive engagement before AI output:

a) Brain Dump – Users write down what they already know. b) Question Refinement – Users clarify and focus their question. c) Guided AI Chat – AI responses are provided only after the first two steps are completed.

Each step must be completed before progressing, reinforcing thoughtful interaction.

User Flow -User enters a brain dump with a minimum of 30 words. -clicking Keep writing to unlock enables the next step.

User refines their question.
A guided chat interface opens, responding based on the refined question.
All transitions are managed through local React state.

**Gemini AI Integration**

/api/gemini middleware route proxies requests to Gemini when an API key is available

Graceful fallback responses are returned when no API key is present

Allows the frontend to function without additional configuration

**Tech Stack**

-React
-Vite
-JavaScript
-Node.js
-Express
-Gemini AI API

**Setup & Installation:** 
npm install npm run dev

To enable live AI responses, add:

GEMINI_API_KEY=your_api_key_here 

If no API key is provided, the app will return fallback responses.
