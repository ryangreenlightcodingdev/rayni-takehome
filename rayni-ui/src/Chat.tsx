// src/Chat.tsx
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
  chatId?: string;                     // 👈 controlled by App
  initialMessages?: ChatMessage[];     // 👈 loaded from server
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

  // stable fallback chat id if App hasn't created one yet
  const fallbackIdRef = useRef(Math.random().toString(36).slice(2));
  const chatId = chatIdProp || fallbackIdRef.current;

  const streamBufferRef = useRef<string>("");
  const sourceRef = useRef<EventSource | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // when App loads/switches a chat, set those messages
  useEffect(() => {
    setMessages(initialMessages ?? []);
  }, [chatId, initialMessages]);

  // auto-scroll
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
      const placeholder: ChatMessage = {
        id: placeholderId,
        role: "assistant",
        content: "",
      };
      setMessages((m) => [...m, placeholder]);

      setIsStreaming(true);
      streamBufferRef.current = "";

      // Prefer a PDF for citations
      const pickPrimaryDocId = () => {
        const pdf =
          docs.find(
            (d) =>
              (d.mimeType && d.mimeType.includes("pdf")) ||
              /\.pdf$/i.test(d.name)
          ) || null;
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

      const es = new EventSource(
        `http://localhost:4000/api/chat/stream?${q.toString()}`
      );
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
        } catch (e) {
          console.error("chunk parse error", e);
        }
      });

      es.addEventListener("done", (ev: MessageEvent) => {
        try {
          const { message } = JSON.parse(ev.data) as { message: ChatMessage };
          setMessages((prev) =>
            prev.map((m) => (m.id === placeholderId ? { ...message } : m))
          );
        } catch (e) {
          console.error("done parse error", e);
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
    [chatId, docs, instrumentIds, projectId]
  );

  useEffect(() => {
    return () => {
      sourceRef.current?.close();
    };
  }, []);

  const onSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    const val = input.trim();
    if (!val || isStreaming) return;
    startStream(val);
    setInput("");
  };

  // reactions + comments
  const sendReaction = async (messageId: string, type: "up" | "down") => {
    try {
      const res = await fetch("http://localhost:4000/api/reactions", {
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
    } catch (e) {
      console.error("reaction error", e);
    }
  };

  const [openCommentFor, setOpenCommentFor] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const submitComment = async (messageId: string) => {
    const text = (commentDrafts[messageId] || "").trim();
    if (!text) return;
    try {
      const res = await fetch("http://localhost:4000/api/comments", {
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
    } catch (e) {
      console.error("comment error", e);
    }
  };

  const renderMessage = (m: ChatMessage) => {
    const isUser = m.role === "user";
    const open = openCommentFor === m.id;

    return (
      <div
        key={m.id}
        className={`flex ${isUser ? "justify-end" : "justify-start"} my-2`}
      >
        <div
          className={`max-w-[75%] rounded p-3 ${
            isUser ? "bg-blue-100" : "bg-gray-100"
          } whitespace-pre-wrap`}
        >
          <div className="prose prose-sm max-w-none">
          <ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    img: ({ node, ...props }) => (
      // eslint-disable-next-line jsx-a11y/alt-text
      <img {...props} loading="lazy" className="my-2 rounded-md max-w-full h-auto" />
    ),
    table: ({ node, ...props }) => (
      <div className="my-2 overflow-x-auto">
        <table {...props} className="table-auto border-collapse w-full" />
      </div>
    ),
    th: ({ node, ...props }) => (
      <th {...props} className="border px-2 py-1 text-left align-top" />
    ),
    td: ({ node, ...props }) => (
      <td {...props} className="border px-2 py-1 align-top" />
    ),
  }}
>
  {m.content}
</ReactMarkdown>
          </div>

          {m.citations?.length ? (
            <div className="mt-2 flex gap-2 text-xs">
              {m.citations.map((c) => (
                <button
                  key={c.label}
                  className="underline hover:no-underline"
                  onClick={() => onOpenCitation(c.docId, c.page)}
                  title={`Open ${c.label} (${c.docId}${
                    c.page ? ` p.${c.page}` : ""
                  })`}
                >
                  {c.label}
                  {c.page ? ` p.${c.page}` : ""}
                </button>
              ))}
            </div>
          ) : null}

          {!isUser && (
            <div className="mt-3 flex items-center gap-3 text-xs">
              <button
                className="px-2 py-1 border rounded"
                onClick={() => sendReaction(m.id, "up")}
              >
                👍 {m.reactions?.up ?? 0}
              </button>
              <button
                className="px-2 py-1 border rounded"
                onClick={() => sendReaction(m.id, "down")}
              >
                👎 {m.reactions?.down ?? 0}
              </button>
              <button
                className="px-2 py-1 border rounded"
                onClick={() => setOpenCommentFor(open ? null : m.id)}
              >
                💬 {m.comments?.length ?? 0}
              </button>
            </div>
          )}

          {!isUser && open && (
            <div className="mt-2">
              <textarea
                value={commentDrafts[m.id] || ""}
                onChange={(e) =>
                  setCommentDrafts((d) => ({ ...d, [m.id]: e.target.value }))
                }
                placeholder="Add a comment…"
                className="w-full border rounded p-2 text-sm"
                rows={2}
              />
              <div className="mt-2 flex gap-2">
                <button
                  className="px-2 py-1 bg-blue-600 text-white rounded"
                  onClick={() => submitComment(m.id)}
                >
                  Submit
                </button>
                <button
                  className="px-2 py-1 border rounded"
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
        {isStreaming && <div className="text-xs text-gray-400 mt-2">Streaming…</div>}
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
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
