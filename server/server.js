// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------
// OAuth config
// -----------------------------
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  FRONTEND_URL = "http://localhost:3000", // fallback for local
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  console.warn("⚠️ Missing Google OAuth env vars. Check your .env file!");
}

app.get("/auth/config", (req, res) => {
  res.json({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
  });
});

// -----------------------------
// OAuth callback
// -----------------------------
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  console.log("✅ Received authorization code:", code);

  if (!code) return res.status(400).send("No code received");

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI, // must exactly match Cloud Console
        grant_type: "authorization_code",
      }),
    });

    const data = await response.json();
    console.log("✅ Token exchange result:", data);

    if (data.error) {
      return res.status(400).send(`Error: ${data.error_description}`);
    }

    // Redirect back to frontend with token in query
    res.redirect(`${FRONTEND_URL}?access_token=${data.access_token}`);
  } catch (err) {
    console.error("❌ Token exchange failed:", err);
    res.status(500).send("Token exchange failed");
  }
});

// -----------------------------
// In-memory mock database
// -----------------------------
const db = {
  projects: [
    { id: "p1", name: "Project X – Protein Yield" },
    { id: "p2", name: "Project Y – Low Signal Study" },
  ],
  instruments: [
    { id: "i1", name: "HPLC", projectId: "p1" },
    { id: "i2", name: "LC-MS", projectId: "p1" },
    { id: "i3", name: "Microscope", projectId: "p2" },
    { id: "i4", name: "Mass Spectrometer", projectId: "p2" },
    { id: "i5", name: "pH Meter", projectId: "p1" },
  ],
  docs: [
    {
      id: "d1",
      name: "Orbitrap Exploris MX Software Manual.pdf",
      source: "local",
      mimeType: "application/pdf",
      status: "indexed",
      previewUrl: "/docs/orbitrap-exploris-mx.pdf",
      pages: 120,
    },
    {
      id: "d2",
      name: "HPLC_Quick_Start.pdf",
      source: "local",
      mimeType: "application/pdf",
      status: "indexed",
      previewUrl: "/docs/hplc-quick-start.pdf",
      pages: 24,
    },
    {
      id: "d3",
      name: "LCMS_Troubleshooting.docx",
      source: "local",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      status: "uploaded",
      previewUrl: null,
      pages: null,
    },
    {
      id: "d4",
      name: "Instrument_Safety.pptx",
      source: "local",
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      status: "queued",
      previewUrl: null,
      pages: null,
    },
    {
      id: "d5",
      name: "notes.txt",
      source: "local",
      mimeType: "text/plain",
      status: "indexed",
      previewUrl: "/docs/notes.txt",
      pages: null,
    },
  ],
  chats: [
    {
      id: "c1",
      title: "HPLC: Low signal troubleshooting",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Why is HPLC signal low after maintenance?",
          createdAt: Date.now() - 86400000,
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "Try: 1) Verify pump seals and leaks. 2) Check mobile phase composition and degas. 3) Re-calibrate detector.",
          createdAt: Date.now() - 86400000,
          citations: [
            { label: "[1]", docId: "d2", page: 5 },
            { label: "[2]", docId: "d1", page: 42 },
          ],
          reactions: { up: 2, down: 0 },
          comments: [],
        },
      ],
    },
    { id: "c2", title: "LC-MS: Tuning & calibration basics", messages: [] },
  ],
};

// -----------------------------
// Helpers
// -----------------------------
const uuid = () => Math.random().toString(36).slice(2, 10);
function advanceDocStatus(doc) {
  if (doc.status === "queued") doc.status = "uploaded";
  else if (doc.status === "uploaded") doc.status = "indexed";
}

// -----------------------------
// Seed/mock API routes
// -----------------------------
app.get("/api/projects", (req, res) => res.json(db.projects));

app.get("/api/instruments", (req, res) => {
  const { projectId } = req.query;
  const list = projectId
    ? db.instruments.filter((i) => i.projectId === projectId)
    : db.instruments;
  res.json(list);
});

app.get("/api/docs", (req, res) => res.json(db.docs));

app.get("/api/docs/:id", (req, res) => {
  const doc = db.docs.find((d) => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: "Not found" });
  res.json(doc);
});

app.post("/api/docs/:id/index", (req, res) => {
  const doc = db.docs.find((d) => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: "Not found" });
  advanceDocStatus(doc);
  res.json(doc);
});

app.get("/api/chats", (req, res) => {
  const summaries = db.chats.map((c) => ({
    id: c.id,
    title: c.title,
    messageCount: c.messages.length,
    lastUpdated:
      c.messages.length > 0 ? c.messages[c.messages.length - 1].createdAt : null,
  }));
  res.json(summaries);
});

app.get("/api/chats/:id", (req, res) => {
  const chat = db.chats.find((c) => c.id === req.params.id);
  if (!chat) return res.status(404).json({ error: "Not found" });
  res.json(chat);
});

app.post("/api/chats", (req, res) => {
  const { title } = req.body;
  const chat = { id: uuid(), title: title || "New Chat", messages: [] };
  db.chats.push(chat);
  res.status(201).json(chat);
});

app.post("/api/reactions", (req, res) => {
  const { chatId, messageId, type } = req.body; // "up" | "down"
  const chat = db.chats.find((c) => c.id === chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  const msg = chat.messages.find((m) => m.id === messageId);
  if (!msg) return res.status(404).json({ error: "Message not found" });

  msg.reactions ||= { up: 0, down: 0 };
  if (type === "up") msg.reactions.up++;
  if (type === "down") msg.reactions.down++;
  res.json({ reactions: msg.reactions });
});

app.post("/api/comments", (req, res) => {
  const { chatId, messageId, text } = req.body;
  const chat = db.chats.find((c) => c.id === chatId);
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  const msg = chat.messages.find((m) => m.id === messageId);
  if (!msg) return res.status(404).json({ error: "Message not found" });

  msg.comments ||= [];
  msg.comments.push({ id: uuid(), text, createdAt: Date.now() });
  res.json({ comments: msg.comments });
});

// -----------------------------
// Chat (non-streaming mock)
// -----------------------------
app.post("/api/chat", (req, res) => {
  const { chatId, message, projectId, instrumentIds, docs, primaryDocId } = req.body;
  console.log("📩 Chat request received:", {
    chatId,
    message,
    projectId,
    instrumentIds,
    docs,
    primaryDocId,
  });

  const chat =
    db.chats.find((c) => c.id === chatId) ||
    (() => {
      const c = { id: chatId || uuid(), title: "Untitled Chat", messages: [] };
      db.chats.push(c);
      return c;
    })();

  const userMsg = { id: uuid(), role: "user", content: message, createdAt: Date.now() };
  chat.messages.push(userMsg);

  const targetDocId = String(primaryDocId || db.docs[0]?.id || "d1");
  const citations = [
    { label: "[1]", docId: targetDocId, page: 2 },
    { label: "[2]", docId: targetDocId, page: 5 },
  ];
  const replyText = `Try checking the pump seals ${citations[0].label} and recalibrate the detector ${citations[1].label}.`;
  const assistantMsg = {
    id: uuid(),
    role: "assistant",
    content: replyText,
    createdAt: Date.now(),
    citations,
  };
  chat.messages.push(assistantMsg);

  res.json({ message: assistantMsg, chatId: chat.id });
});

// -----------------------------
// Chat (SSE streaming mock)
// -----------------------------
app.get("/api/chat/stream", (req, res) => {
  const {
    chatId = uuid(),
    message = "",
    projectId,
    instrumentIds,
    docs,
    primaryDocId,
  } = req.query;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const chat =
    db.chats.find((c) => c.id === chatId) ||
    (() => {
      const c = { id: chatId, title: "Untitled Chat", messages: [] };
      db.chats.push(c);
      return c;
    })();

  const userMsg = { id: uuid(), role: "user", content: String(message), createdAt: Date.now() };
  chat.messages.push(userMsg);

  const full =
    "Checking pump seals and lines can fix low HPLC signal. Also verify mobile phase mixing and recalibrate the detector.";

  const targetDocId = String(primaryDocId || db.docs[0]?.id || "d1");
  const citations = [
    { label: "[1]", docId: targetDocId, page: 2 },
    { label: "[2]", docId: targetDocId, page: 5 },
  ];

  const words = full.split(" ");
  let idx = 0;

  const interval = setInterval(() => {
    if (idx < words.length) {
      const chunk = words[idx++] + (idx < words.length ? " " : "");
      res.write(`event: chunk\n`);
      res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
    } else {
      clearInterval(interval);

      const assistantMsg = {
        id: uuid(),
        role: "assistant",
        content: `${full} ${citations.map((c) => c.label).join(" ")}`,
        createdAt: Date.now(),
        citations,
      };
      chat.messages.push(assistantMsg);

      res.write(`event: done\n`);
      res.write(`data: ${JSON.stringify({ message: assistantMsg, chatId })}\n\n`);
      res.end();
    }
  }, 40);
});

// -----------------------------
// Server start
// -----------------------------
app.listen(4000, () => {
  console.log("🚀 Mock backend running on http://localhost:4000");
});
