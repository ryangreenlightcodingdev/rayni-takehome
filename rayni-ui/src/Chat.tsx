import React, { useState } from "react";

type Citation = { label: string; docId: string; page?: number };

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

type ChatProps = {
  projectId: string;
  instrumentIds: string[];
  docs: any[]; // uploadedDocs passed in from App
  onOpenCitation: (docId: string, page?: number) => void;
};

const Chat: React.FC<ChatProps> = ({
  projectId,
  instrumentIds,
  docs,
  onOpenCitation,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || !projectId) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Start assistant message with empty content
    const aiId = crypto.randomUUID();
    const aiMsg: Message = { id: aiId, role: "assistant", content: "" };
    setMessages((prev) => [...prev, aiMsg]);

    // Fake streaming response
    const fakeReply =
      "AI (mock): Try checking the pump seals [1] and recalibrate the detector [2].";
    const words = fakeReply.split(" ");
    let i = 0;

    const interval = setInterval(() => {
      i++;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiId ? { ...m, content: words.slice(0, i).join(" ") } : m
        )
      );

      if (i === words.length) {
        clearInterval(interval);

        // Attach mock citations after streaming finishes
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? {
                  ...m,
                  citations: [
                    { label: "[1]", docId: "d1", page: 42 },
                    { label: "[2]", docId: "d1", page: 73 },
                  ],
                }
              : m
          )
        );

        setLoading(false);
      }
    }, 200);
  };

  const handleFeedback = (msgId: string, value: "up" | "down") => {
    console.log(`Feedback for ${msgId}: ${value}`);
    // TODO: send to mocked backend
  };

  return (
    <div className="mt-6 p-4 border rounded bg-white shadow">
      <h2 className="text-lg font-semibold mb-2">AI Chat</h2>

      <div className="h-64 overflow-y-auto border p-2 mb-2 bg-gray-50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-2 p-2 rounded max-w-lg ${
              msg.role === "user"
                ? "bg-blue-100 ml-auto text-right"
                : "bg-gray-200 text-left"
            }`}
          >
            <div>
              <strong>{msg.role === "user" ? "You" : "AI"}:</strong>{" "}
              {msg.content}
            </div>

            {/* Citations */}
            {msg.role === "assistant" && msg.citations && (
              <div className="mt-1 space-x-2">
                {msg.citations.map((c) => (
                  <button
                    key={c.label}
                    className="underline text-xs text-blue-600"
                    onClick={() => onOpenCitation(c.docId, c.page)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {/* Feedback */}
            {msg.role === "assistant" && (
              <div className="mt-1 space-x-2 text-sm">
                <button onClick={() => handleFeedback(msg.id, "up")}>👍</button>
                <button onClick={() => handleFeedback(msg.id, "down")}>
                  👎
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-grow border rounded p-2"
          placeholder={
            projectId ? "Ask something..." : "Select a project to chat"
          }
          disabled={loading || !projectId}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !projectId}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
};

export default Chat;
