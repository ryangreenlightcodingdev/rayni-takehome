// src/App.tsx
import React, { useEffect, useState } from "react";
import FileUpload from "./FileUpload";
import PdfViewer from "./PdfViewer";
import Chat from "./Chat";

type Doc = {
  id: string;
  name: string;
  status: string;
  source: "local" | "google-drive";
  mimeType: string;
  size?: number;
  url?: string;
  page?: number;
};

type Project = { id: string; name: string };
type Instrument = { id: string; name: string; projectId: string };

type ChatSummary = {
  id: string;
  title: string;
  messageCount: number;
  lastUpdated: number | null;
};
type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: { label: string; docId: string; page?: number }[];
  reactions?: { up: number; down: number };
  comments?: { id: string; text: string; createdAt: number }[];
};

const App: React.FC = () => {
  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [pickerLoaded, setPickerLoaded] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);

  const [uploadedDocs, setUploadedDocs] = useState<Doc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);

  const [driveToken, setDriveToken] = useState<string | null>(null);
  // Use a ref so the token is available synchronously in pickerCallback
const driveTokenRef = React.useRef<string | null>(null);


  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatMessages, setActiveChatMessages] = useState<ChatMsg[]>([]);

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
  const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string;
  const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

  // -------- boot --------
  useEffect(() => {
    const loadScript = () => {
      const gapi = (window as any).gapi;
      if (gapi) {
        gapi.load("client", async () => {
          await gapi.client.init({ apiKey: API_KEY });
          setGapiLoaded(true);
        });
        gapi.load("picker", () => setPickerLoaded(true));
      }
      const googleObj = (window as any).google;
      if (googleObj?.accounts?.oauth2) setGisLoaded(true);
    };
    loadScript();

    // seed data
    setProjects([
      { id: "p1", name: "Project X – Protein Yield" },
      { id: "p2", name: "Project Y – Low Signal Study" },
    ]);
    setInstruments([
      { id: "i1", name: "HPLC", projectId: "p1" },
      { id: "i2", name: "LC-MS", projectId: "p1" },
      { id: "i3", name: "Microscope", projectId: "p2" },
      { id: "i4", name: "Mass Spectrometer", projectId: "p2" },
    ]);
  }, [API_KEY]);

  // ------- Chats list load -------
  useEffect(() => {
    fetch("http://localhost:4000/api/chats")
      .then((r) => r.json())
      .then(setChats)
      .catch(console.error);
  }, []);

  const createNewChat = async () => {
    const res = await fetch("http://localhost:4000/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Chat" }),
    });
    const chat = await res.json();
    setChats((prev) => [
      { id: chat.id, title: chat.title, messageCount: 0, lastUpdated: null },
      ...prev,
    ]);
    setActiveChatId(chat.id);
    setActiveChatMessages([]);
  };

  const loadChat = async (id: string) => {
    setActiveChatId(id);
    const chat = await fetch(`http://localhost:4000/api/chats/${id}`).then((r) =>
      r.json()
    );
    setActiveChatMessages(chat.messages || []);
  };

  // ---------- Google Auth + Picker (one-click flow) ----------
  const requestDriveToken = (): Promise<string> =>
    new Promise((resolve, reject) => {
      try {
        const googleObj = (window as any).google;
        const tokenClient = googleObj.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (resp: any) => {
            if (resp?.error) return reject(resp);
            resolve(resp.access_token);
          },
        });
        // If we already have a token in the ref, avoid the consent prompt
        tokenClient.requestAccessToken({ prompt: driveTokenRef.current ? "" : "consent" });
      } catch (e) {
        reject(e);
      }
    });
  

    const handleAuthClick = async (e?: React.MouseEvent) => {
      e?.preventDefault();
      if (!gapiLoaded || !pickerLoaded || !gisLoaded) return;
      try {
        const token = await requestDriveToken();
        setDriveToken(token);          // keep state for anything else that uses it
        driveTokenRef.current = token; // <-- immediate availability for callbacks
        openPicker(token);
      } catch (err) {
        console.error("Drive token error:", err);
      }
    };
    

  const openPicker = (accessToken: string) => {
    const googleObj = (window as any).google;
    if (!googleObj?.picker) {
      console.error("❌ Picker API not loaded");
      return;
    }
    const view = new googleObj.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true);

    const picker = new googleObj.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .setOrigin(window.location.protocol + "//" + window.location.host)
      .setCallback(pickerCallback)
      .build();

    picker.setVisible(true);
  };

  // ---------- Drive helpers ----------
  const isGoogleDocType = (mime: string) =>
    mime?.startsWith("application/vnd.google-apps.");

  const exportMimeForGoogleType = (_mime: string) => "application/pdf";

  const fetchDriveObjectUrl = async (
    fileId: string,
    mimeType: string,
    token: string
  ) => {
    const endpoint = isGoogleDocType(mimeType)
      ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(
          exportMimeForGoogleType(mimeType)
        )}`
      : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Drive download failed: ${res.status} ${res.statusText}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const outMime =
      isGoogleDocType(mimeType) ? "application/pdf" : blob.type || mimeType;
    return { url, mime: outMime, size: blob.size };
  };

  const pickerCallback = async (data: any) => {
    if (data.action !== (window as any).google.picker.Action.PICKED) return;
  
    const token = driveTokenRef.current; // <-- use ref (state may not be set yet)
    if (!token) {
      console.error("No Drive token available yet");
      return;
    }
  
    try {
      const picked = data.docs as any[];
  
      const driveDocs = await Promise.all(
        picked.map(async (doc) => {
          const { url, mime, size } = await fetchDriveObjectUrl(
            doc.id,
            doc.mimeType,
            token
          );
  
          return {
            id: doc.id,
            name: doc.name,
            mimeType: mime,
            size,
            url,
            source: "google-drive",
            status: "Selected from Google Drive",
          };
        })
      );
  
      // Example: update your state
      setUploadedDocs((prev) => [...prev, ...driveDocs]);
    } catch (err) {
      console.error("Error fetching Drive docs:", err);
    }
  };
  

  // ---------- Local uploads ----------
  const handleFilesUploaded = (files: any[]) => {
    const localDocs = files.map((file) => ({
      id: file.id,
      name: file.name,
      status: "Local file",
      source: "local" as const,
      mimeType: (file as any).type || "application/octet-stream",
      size: (file as any).size,
      url: (file as any).url,
    }));
    setUploadedDocs((prev) => [...prev, ...localDocs]);
  };

  // ---------- Citations ----------
  const handleOpenCitation = (docId: string, page?: number) => {
    const exact = uploadedDocs.find((d) => d.id === docId);
    const fallbackPdf =
      uploadedDocs.find(
        (d) => d.mimeType === "application/pdf" || /\.pdf$/i.test(d.name)
      ) || null;
    const chosen = exact || fallbackPdf || uploadedDocs[0] || null;
    if (chosen) setSelectedDoc({ ...chosen, page });
  };

  // ---------- Context selector helpers ----------
  const instrumentsForSelectedProject = React.useMemo(
    () =>
      instruments.filter((i) =>
        selectedProject ? i.projectId === selectedProject : true
      ),
    [instruments, selectedProject]
  );

  const handleProjectChange = (value: string) => {
    setSelectedProject(value);
    setSelectedInstruments((prev) =>
      prev.filter((id) =>
        instruments.some((i) => i.id === id && i.projectId === value)
      )
    );
  };

  const toggleInstrument = (id: string) => {
    setSelectedInstruments((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const clearContext = () => {
    setSelectedProject("");
    setSelectedInstruments([]);
  };

  // ---------- Render ----------
  return (
    <div className="flex h-screen bg-gradient-to-b from-blue-100 to-white">
      {/* Left: Sources */}
      <div className="w-1/5 border-r p-4 bg-white">
        <h2 className="font-semibold mb-3">Sources</h2>

        <FileUpload onFilesUploaded={handleFilesUploaded} />

        <button
          type="button"
          onClick={handleAuthClick}
          disabled={!gapiLoaded || !pickerLoaded || !gisLoaded}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 disabled:opacity-50 w-full"
        >
          {gapiLoaded && pickerLoaded && gisLoaded
            ? "Pick from Google Drive"
            : "Loading..."}
        </button>

        <ul className="mt-4 space-y-2">
          {uploadedDocs.map((doc) => (
            <li
              key={doc.id}
              className={`p-2 border rounded cursor-pointer hover:bg-gray-100 ${
                selectedDoc?.id === doc.id ? "bg-blue-50" : ""
              }`}
              onClick={() => setSelectedDoc(doc)}
            >
              <span className="font-medium">{doc.name}</span>
              <div className="text-xs text-gray-500">
                {doc.source} • {doc.mimeType}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Center: Top bar + Chat */}
      <div className="flex flex-col w-3/5 border-r">
        <div className="flex items-center justify-between p-3 border-b bg-white">
          {/* left: chats */}
          <div className="flex items-center gap-3">
            <button
              onClick={createNewChat}
              className="px-3 py-1 bg-blue-600 text-white rounded"
            >
              New Chat
            </button>

            <select
              value={activeChatId || ""}
              onChange={(e) => e.target.value && loadChat(e.target.value)}
              className="border px-2 py-1 rounded"
              title="Open a saved chat"
            >
              <option value="">Open saved chat…</option>
              {chats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} {c.messageCount ? `(${c.messageCount})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* middle: context selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Project</label>
              <select
                value={selectedProject}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="border px-2 py-1 rounded min-w-[220px]"
              >
                <option value="">— Select project —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Instruments</label>
              <div className="flex flex-wrap items-center gap-2 max-w-[520px]">
                {instrumentsForSelectedProject.map((ins) => {
                  const active = selectedInstruments.includes(ins.id);
                  return (
                    <button
                      key={ins.id}
                      type="button"
                      onClick={() => toggleInstrument(ins.id)}
                      className={`px-2 py-1 rounded border text-sm ${
                        active
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                      title={active ? "Click to remove" : "Click to add"}
                    >
                      {ins.name}
                    </button>
                  );
                })}
                {!instrumentsForSelectedProject.length && (
                  <span className="text-xs text-gray-400">
                    Pick a project first
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={clearContext}
              className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
              title="Clear project & instrument selection"
            >
              Clear
            </button>
          </div>

          {/* right: save */}
          <button className="px-3 py-1 border rounded text-sm">
            Save Chat as Note
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <Chat
            chatId={activeChatId || undefined}
            initialMessages={activeChatMessages}
            projectId={selectedProject}
            instrumentIds={selectedInstruments}
            docs={uploadedDocs}
            onOpenCitation={handleOpenCitation}
          />
        </div>
      </div>

      {/* Right: Preview */}
      <div className="w-1/5 p-4 bg-white">
        <h2 className="font-semibold mb-3">Preview</h2>
        {selectedDoc ? (
          selectedDoc.mimeType === "application/pdf" ||
          selectedDoc.mimeType.startsWith("image/") ? (
            <div className="h-[80vh] overflow-y-auto border">
              <PdfViewer
                fileUrl={selectedDoc.url || "/test.pdf"}
                mimeType={selectedDoc.mimeType}
                page={selectedDoc.page}
              />
            </div>
          ) : (
            <div className="text-gray-600 text-sm">
              Preview not available for this file type.
            </div>
          )
        ) : (
          <p className="text-gray-400 text-sm">Select a document to preview</p>
        )}
      </div>
    </div>
  );
};

export default App;
