// Chat.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

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
  docs: Array<{ id: string; name: string }>;
  onOpenCitation: (docId: string, page?: number) => void;
};

const Chat: React.FC<ChatProps> = ({ projectId, instrumentIds, docs, onOpenCitation }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatId] = useState(() => Math.random().toString(36).slice(2));

  const streamBufferRef = useRef<string>(""); // accumulates current assistant text
  const sourceRef = useRef<EventSource | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // auto-scroll to bottom
  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isStreaming]);

  const startStream = useCallback(
    (prompt: string) => {
      // 1) push user message
      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: prompt };
      setMessages((m) => [...m, userMsg]);

      // 2) create an empty assistant placeholder to paint deltas into
      const placeholderId = crypto.randomUUID();
      const placeholder: Message = { id: placeholderId, role: "assistant", content: "" };
      setMessages((m) => [...m, placeholder]);

      setIsStreaming(true);
      streamBufferRef.current = "";

      // Pick the first doc as the "primary" doc for citations
      const primaryDocId = docs[0]?.id || "";

      // Build query string for SSE
      const q = new URLSearchParams({
        chatId,
        message: prompt,
        projectId: projectId || "",
        instrumentIds: instrumentIds.join(","),
        docs: String(docs.length),
        primaryDocId, // 👈 ensures backend ties citations to the correct doc
      });

      const es = new EventSource(`http://localhost:4000/api/chat/stream?${q.toString()}`);
      sourceRef.current = es;

      es.addEventListener("chunk", (ev: MessageEvent) => {
        try {
          const { delta } = JSON.parse(ev.data);
          streamBufferRef.current += delta || "";
          // paint into the last assistant message
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholderId ? { ...m, content: streamBufferRef.current } : m
            )
          );
        } catch {}
      });

      es.addEventListener("done", (ev: MessageEvent) => {
        try {
          const { message } = JSON.parse(ev.data) as { message: Message };
          // replace placeholder with final message (content + citations)
          setMessages((prev) =>
            prev.map((m) => (m.id === placeholderId ? { ...message } : m))
          );
        } catch {
          // fallback: finalize with whatever we buffered
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
      // cleanup on unmount
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

  const renderMessage = (m: Message) => {
    const isUser = m.role === "user";
    return (
      <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"} my-2`}>
        <div
          className={`max-w-[75%] rounded p-3 ${
            isUser ? "bg-blue-100" : "bg-gray-100"
          } whitespace-pre-wrap`}
        >
          {/* Markdown rendering with image/table support */}
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                img: ({ node, ...props }) => (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <img
                    {...props}
                    loading="lazy"
                    className="my-2 rounded-md max-w-full h-auto"
                  />
                ),
                table: ({ node, ...props }) => (
                  <div className="my-2 overflow-x-auto">
                    <table {...props} className="table-auto border-collapse" />
                  </div>
                ),
                th: ({ node, ...props }) => (
                  <th {...props} className="border px-2 py-1 text-left" />
                ),
                td: ({ node, ...props }) => (
                  <td {...props} className="border px-2 py-1 align-top" />
                ),
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
                  title={`Open ${c.label} (${c.docId}${c.page ? ` p.${c.page}` : ""})`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : null}
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
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something…"
          className="flex-1 border rounded px-3 py-2"
          disabled={isStreaming}
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
