import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch"; // for Node.js HTTP requests

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Validate env vars
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  console.warn("⚠️ Missing Google OAuth env vars. Check your .env file!");
}

// ✅ Expose safe OAuth config to frontend
app.get("/auth/config", (req, res) => {
  res.json({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
  });
});

// ✅ Google OAuth callback
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  console.log("✅ Received authorization code:", code);

  if (!code) {
    return res.status(400).send("No code received");
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const data = await response.json();
    console.log("✅ Token exchange result:", data);

    if (data.error) {
      return res.status(400).send(`Error: ${data.error_description}`);
    }

    // Redirect back to frontend with token in query
    res.redirect(`http://localhost:5173?access_token=${data.access_token}`);
  } catch (err) {
    console.error("❌ Token exchange failed:", err);
    res.status(500).send("Token exchange failed");
  }
});

// ✅ Mock Chat API (AI assistant simulation)
app.post("/api/chat", (req, res) => {
  const { message, projectId, instrumentIds, docs } = req.body;
  console.log("📩 Chat request received:", { message, projectId, instrumentIds, docs });

  // Fake AI reply (mocking behavior for now)
  const reply = `🤖 AI (mock): You said "${message}". Context → Project=${projectId}, Instruments=${instrumentIds?.join(", ") || "none"}, Docs=${docs?.length || 0}`;

  res.json({ reply });
});

// Start server
app.listen(4000, () => {
  console.log("🚀 Server running on http://localhost:4000");
});
