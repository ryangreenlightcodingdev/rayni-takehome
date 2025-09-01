import React, { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ChatProps = {
  projectId: string;
  instrumentIds: string[];
  docs: any[]; // uploadedDocs passed in from App
};

const Chat: React.FC<ChatProps> = ({ projectId, instrumentIds, docs }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:4000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          projectId,
          instrumentIds,
          docs,
        }),
      });

      const data = await res.json();
      const aiMsg: Message = { role: "assistant", content: data.reply };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Error talking to AI." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 p-4 border rounded bg-white shadow">
      <h2 className="text-lg font-semibold mb-2">AI Chat</h2>
      <div className="h-64 overflow-y-auto border p-2 mb-2 bg-gray-50">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-2 p-2 rounded ${
              msg.role === "user"
                ? "bg-blue-100 text-right"
                : "bg-gray-200 text-left"
            }`}
          >
            <strong>{msg.role === "user" ? "You" : "AI"}:</strong>{" "}
            {msg.content}
          </div>
        ))}
      </div>
      <div className="flex space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-grow border rounded p-2"
          placeholder="Ask something..."
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
};

export default Chat;
