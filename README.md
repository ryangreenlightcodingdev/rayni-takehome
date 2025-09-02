# Lab AI Chat UI

A single-screen web app prototype for scientists to chat with an AI assistant in the context of projects, instruments, and uploaded documents.  
Built with **React (Vite + TypeScript)** on the frontend and a **Node.js/Express mock backend**.  

This project demonstrates:
- Real file uploads (PDF, DOCX, PPTX, TXT, JPG, PNG) with status pipeline (queued → uploaded → indexed).
- Google Drive integration (OAuth2 + Picker).
- AI-like chat interface with:
  - Streaming responses
  - Inline citations linked to documents
  - Reactions (👍 👎)
  - Comments on responses
- Project and instrument scoping for chats.
- Document preview (PDF, images, text).
- Mock backend simulating AI responses, citations, reactions, and comments.

---

## 🚀 Tech Stack
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, React-PDF
- **Backend**: Node.js, Express
- **Auth**: Google OAuth 2.0 (via client + server)
- **Deployment**: Vercel (frontend) + Render/Heroku (backend)

---

## 📂 Project Structure
/client → React + Vite frontend
/server → Express backend (mock APIs)



---

## ⚙️ Setup

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- Google Cloud project with OAuth2 credentials

### Frontend
```bash
cd client
cp .env.local.example .env.local
npm install
npm run dev

Environment variables (.env.local):

VITE_GOOGLE_CLIENT_ID=your-client-id
VITE_GOOGLE_REDIRECT_URI=http://localhost:4000/oauth2callback
VITE_GOOGLE_API_KEY=your-api-key



Backend
cd server
cp .env.example .env
npm install
npm start


Environment variables (.env):
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/oauth2callback


🧪 Features Demo

Drag-and-drop or select files → watch them move from queued → uploaded → indexed.

Pick files from Google Drive via the picker.

Start a new chat, type a question, and watch the AI response stream in with citations.

Click a citation to preview the matching doc/page.

Upvote/downvote responses, leave threaded comments.

Switch projects/instruments to scope the chat context.