import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Citation = { label: string; docId: string; page?: number };
type Reactions = { up: number; down: number };
type Comment = { id: string; text: string; createdAt: number };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  reactions?: Reactions;
  comments?: Comment[];
};

type ChatProps = {
  chatId?: string;
  initialMessages?: ChatMessage[];
  projectId: string;
  instrumentIds: string[];
  docs: Array<{ id: string; name: string; mimeType?: string }>;
  onOpenCitation: (docId: string, page?: number) => void;
};

const Chat: React.FC<ChatProps> = ({
  chatId: chatIdProp,
  initialMessages,
  projectId,
  instrumentIds,
  docs,
  onOpenCitation,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const fallbackIdRef = useRef(Math.random().toString(36).slice(2));
  const chatId = chatIdProp || fallbackIdRef.current;

  const streamBufferRef = useRef<string>("");
  const sourceRef = useRef<EventSource | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // 👇 pull API_URL from Vite env
  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    setMessages(initialMessages ?? []);
  }, [chatId, initialMessages]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isStreaming]);

  const startStream = useCallback(
    (prompt: string) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
      };
      setMessages((m) => [...m, userMsg]);

      const placeholderId = crypto.randomUUID();
      setMessages((m) => [
        ...m,
        { id: placeholderId, role: "assistant", content: "" },
      ]);

      setIsStreaming(true);
      streamBufferRef.current = "";

      const pickPrimaryDocId = () => {
        const pdf = docs.find(
          (d) =>
            (d.mimeType && d.mimeType.includes("pdf")) ||
            /\.pdf$/i.test(d.name)
        );
        return pdf?.id || docs[0]?.id || "";
      };
      const primaryDocId = pickPrimaryDocId();

      const q = new URLSearchParams({
        chatId,
        message: prompt,
        projectId: projectId || "",
        instrumentIds: instrumentIds.join(","),
        docs: String(docs.length),
        primaryDocId,
      });

      // 👇 swapped localhost for API_URL
      const es = new EventSource(`${API_URL}/api/chat/stream?${q.toString()}`);
      sourceRef.current = es;

      es.addEventListener("chunk", (ev: MessageEvent) => {
        try {
          const { delta } = JSON.parse(ev.data);
          streamBufferRef.current += delta || "";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholderId
                ? { ...m, content: streamBufferRef.current }
                : m
            )
          );
        } catch {}
      });

      es.addEventListener("done", (ev: MessageEvent) => {
        try {
          const { message } = JSON.parse(ev.data) as { message: ChatMessage };
          setMessages((prev) =>
            prev.map((m) => (m.id === placeholderId ? { ...message } : m))
          );
        } catch {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholderId
                ? { ...m, content: streamBufferRef.current }
                : m
            )
          );
        } finally {
          es.close();
          sourceRef.current = null;
          setIsStreaming(false);
        }
      });

      es.onerror = () => {
        es.close();
        sourceRef.current = null;
        setIsStreaming(false);
      };
    },
    [API_URL, chatId, docs, instrumentIds, projectId]
  );

  useEffect(() => () => sourceRef.current?.close(), []);

  const onSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    const val = input.trim();
    if (!val || isStreaming) return;
    startStream(val);
    setInput("");
  };

  const sendReaction = async (messageId: string, type: "up" | "down") => {
    try {
      const res = await fetch(`${API_URL}/api/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, messageId, type }),
      });
      const data = (await res.json()) as { reactions: Reactions };
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, reactions: data.reactions } : m
        )
      );
    } catch {}
  };

  const [openCommentFor, setOpenCommentFor] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {}
  );
  const submitComment = async (messageId: string) => {
    const text = (commentDrafts[messageId] || "").trim();
    if (!text) return;
    try {
      const res = await fetch(`${API_URL}/api/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, messageId, text }),
      });
      const data = (await res.json()) as { comments: Comment[] };
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, comments: data.comments } : m
        )
      );
      setCommentDrafts((d) => ({ ...d, [messageId]: "" }));
      setOpenCommentFor(null);
    } catch {}
  };

  const renderMessage = (m: ChatMessage) => {
    const isUser = m.role === "user";
    const open = openCommentFor === m.id;

    return (
      <div
        key={m.id}
        className={`chat-row ${isUser ? "justify-end" : "justify-start"}`}
      >
        <div className={`chat-bubble ${isUser ? "user" : ""}`}>
          {/* Markdown */}
          <div className={`chat-md ${isUser ? "chat-md-invert" : ""}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                img: ({ node, ...props }) => <img {...props} loading="lazy" />,
                table: ({ node, ...props }) => <table {...props} />,
                th: ({ node, ...props }) => <th {...props} />,
                td: ({ node, ...props }) => <td {...props} />,
              }}
            >
              {m.content}
            </ReactMarkdown>
          </div>

          {/* Citations */}
          {m.citations?.length ? (
            <div className="mt-2 flex gap-2 text-xs">
              {m.citations.map((c) => (
                <button
                  key={c.label}
                  className="underline hover:no-underline"
                  onClick={() => onOpenCitation(c.docId, c.page)}
                >
                  {c.label}
                  {c.page ? ` p.${c.page}` : ""}
                </button>
              ))}
            </div>
          ) : null}

          {/* Feedback controls for assistant */}
          {!isUser && (
            <div className="mt-3 flex items-center gap-3 text-xs">
              <button
                className="btn btn-ghost"
                onClick={() => sendReaction(m.id, "up")}
              >
                👍 {m.reactions?.up ?? 0}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => sendReaction(m.id, "down")}
              >
                👎 {m.reactions?.down ?? 0}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() =>
                  setOpenCommentFor(open ? null : m.id)
                }
              >
                💬 {m.comments?.length ?? 0}
              </button>
            </div>
          )}

          {/* Comment drawer */}
          {!isUser && open && (
            <div className="mt-2">
              <textarea
                value={commentDrafts[m.id] || ""}
                onChange={(e) =>
                  setCommentDrafts((d) => ({
                    ...d,
                    [m.id]: e.target.value,
                  }))
                }
                placeholder="Add a comment…"
                className="w-full border rounded p-2 text-sm"
                rows={2}
              />
              <div className="mt-2 flex gap-2">
                <button
                  className="btn btn-primary"
                  onClick={() => submitComment(m.id)}
                >
                  Submit
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => setOpenCommentFor(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollerRef} className="flex-1 overflow-y-auto pr-2">
        {messages.map(renderMessage)}
        {isStreaming && (
          <div className="stream-row">
            <span className="stream-chip">Searching</span>
            <span className="stream-chip">Thinking</span>
            <span className="stream-chip">Drafting</span>
            <span className="stream-chip">Generating…</span>
          </div>
        )}
      </div>

      <form onSubmit={onSend} className="mt-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something…"
          className="flex-1 border rounded px-3 py-2 resize-none"
          disabled={isStreaming}
          rows={3}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="btn btn-primary disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
