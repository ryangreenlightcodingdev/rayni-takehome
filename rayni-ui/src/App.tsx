import { useState } from "react";
import { projects, instruments, docs as initialDocs, savedChats } from "./mockData";
import type { Doc } from "./mockData";

function App() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [messages, setMessages] = useState(savedChats[0].messages);
  const [input, setInput] = useState("");
  const [docs, setDocs] = useState<Doc[]>(initialDocs);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg = {
      id: Date.now().toString(),
      role: "user" as const,
      content: input,
      createdAt: Date.now(),
    };
    setMessages([...messages, newMsg]);
    setInput("");
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, projectId: string) => {
    if (!e.target.files) return;

    const file = e.target.files[0];
    if (!file) return;

    const newDoc: Doc = {
      id: Date.now().toString(),
      name: file.name,
      source: "local",
      url: URL.createObjectURL(file), // creates a temporary link
      status: "uploaded",
      projectId,
    };

    setDocs([...docs, newDoc]);
  };

  return (
    <div className="flex h-screen">
      {/* Left Panel */}
      <div className="w-1/3 border-r p-4">
        <h1 className="text-2xl font-bold mb-4">Projects</h1>
        <ul className="space-y-2">
          {projects.map((project) => (
            <li key={project.id}>
              <button
                onClick={() =>
                  setSelectedProjectId(selectedProjectId === project.id ? null : project.id)
                }
                className={`w-full text-left p-2 rounded ${
                  selectedProjectId === project.id
                    ? "bg-blue-100 font-semibold"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                {project.name}
              </button>

              {/* Instruments + Docs */}
              {selectedProjectId === project.id && (
                <div className="ml-4 mt-2 space-y-2">
                  <ul className="ml-2 list-disc">
                    {instruments
                      .filter((inst) => inst.projectId === project.id)
                      .map((inst) => (
                        <li key={inst.id}>{inst.name}</li>
                      ))}
                  </ul>

                  <ul className="ml-2">
                    {docs
                      .filter((doc) => doc.projectId === project.id)
                      .map((doc) => (
                        <li key={doc.id}>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {doc.name}
                          </a>{" "}
                          <span className="text-sm text-gray-500">({doc.status})</span>
                        </li>
                      ))}
                  </ul>

                  {/* Upload button */}
                  <input
                    type="file"
                    accept=".pdf,.docx,.pptx,.txt"
                    onChange={(e) => handleFileUpload(e, project.id)}
                    className="mt-2"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col">
        <h2 className="text-xl font-bold p-4 border-b">AI Chat</h2>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 rounded-lg max-w-md ${
                msg.role === "user"
                  ? "ml-auto bg-blue-500 text-white"
                  : "mr-auto bg-gray-300 text-black"
              }`}
            >
              {msg.content}
            </div>
          ))}
        </div>
        <div className="p-4 border-t flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border rounded p-2"
          />
          <button
            onClick={handleSend}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
