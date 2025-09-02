import React, { useEffect, useState } from "react";
import FileUpload from "./FileUpload";
import PdfViewer from "./PdfViewer";
import Chat from "./Chat";
import PreviewModal from "./PreviewModal";

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
  const [projects, setProjects] = useState<Project[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);

  const driveTokenRef = React.useRef<string | null>(null);

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatMessages, setActiveChatMessages] = useState<ChatMsg[]>([]);

  // Modal preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
  const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string;
  const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

  // boot
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

  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    fetch(`${API_URL}/api/chats`)
      .then((r) => r.json())
      .then(setChats)
      .catch(console.error);
  }, [API_URL]);
  

  const createNewChat = async () => {
    const res = await fetch(`${API_URL}/api/chats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Chat" }),
    });
    const chat = await res.json();
    setChats((prev) => [{ id: chat.id, title: chat.title, messageCount: 0, lastUpdated: null }, ...prev]);
    setActiveChatId(chat.id);
    setActiveChatMessages([]);
  };

  const loadChat = async (id: string) => {
    setActiveChatId(id);
    const chat = await fetch(`${API_URL}/api/chats/${id}`).then((r) => r.json());
    setActiveChatMessages(chat.messages || []);
  };
  // Google Auth + Picker
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
        tokenClient.requestAccessToken({ prompt: driveTokenRef.current ? "" : "consent" });
      } catch (e) { reject(e); }
    });

  const handleAuthClick = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (!gapiLoaded || !pickerLoaded || !gisLoaded) return;
    try {
      const token = await requestDriveToken();
      driveTokenRef.current = token;
      openPicker(token);
    } catch (err) { console.error("Drive token error:", err); }
  };

  const openPicker = (accessToken: string) => {
    const googleObj = (window as any).google;
    if (!googleObj?.picker) { console.error("Picker API not loaded"); return; }
    const view = new googleObj.picker.DocsView().setIncludeFolders(true).setSelectFolderEnabled(true);
    const picker = new googleObj.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .setOrigin(window.location.protocol + "//" + window.location.host)
      .setCallback(pickerCallback)
      .build();
    picker.setVisible(true);
  };

  const isGoogleDocType = (mime: string) => mime?.startsWith("application/vnd.google-apps.");
  const exportMimeForGoogleType = (_mime: string) => "application/pdf";

  const fetchDriveObjectUrl = async (fileId: string, mimeType: string, token: string) => {
    const endpoint = isGoogleDocType(mimeType)
      ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeForGoogleType(mimeType))}`
      : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Drive download failed: ${res.status} ${res.statusText}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const outMime = isGoogleDocType(mimeType) ? "application/pdf" : blob.type || mimeType;
    return { url, mime: outMime, size: blob.size };
  };

  const pickerCallback = async (data: any) => {
    if (data.action !== (window as any).google.picker.Action.PICKED) return;
    const token = driveTokenRef.current;
    if (!token) { console.error("No Drive token available yet"); return; }
    try {
      const picked = data.docs as any[];
      const driveDocs = await Promise.all(
        picked.map(async (doc) => {
          const { url, mime, size } = await fetchDriveObjectUrl(doc.id, doc.mimeType, token);
          return { id: doc.id, name: doc.name, mimeType: mime, size, url, source: "google-drive" as const, status: "Selected from Google Drive" };
        })
      );
      setUploadedDocs((prev) => [...prev, ...driveDocs]);
    } catch (err) { console.error("Error fetching Drive docs:", err); }
  };

  // Local uploads
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

  // Citations → open modal
  const handleOpenCitation = (docId: string, page?: number) => {
    const exact = uploadedDocs.find((d) => d.id === docId);
    const fallbackPdf = uploadedDocs.find((d) => d.mimeType === "application/pdf" || /\.pdf$/i.test(d.name)) || null;
    const chosen = exact || fallbackPdf || uploadedDocs[0] || null;
    if (chosen) { setPreviewDoc({ ...chosen, page }); setPreviewOpen(true); }
  };

  // Context helpers
  const instrumentsForSelectedProject = React.useMemo(
    () => instruments.filter((i) => (selectedProject ? i.projectId === selectedProject : true)),
    [instruments, selectedProject]
  );

  const handleProjectChange = (value: string) => {
    setSelectedProject(value);
    setSelectedInstruments((prev) => prev.filter((id) => instruments.some((i) => i.id === id && i.projectId === value)));
  };
  const toggleInstrument = (id: string) => {
    setSelectedInstruments((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const clearContext = () => { setSelectedProject(""); setSelectedInstruments([]); };

  return (
    <div className="flex h-screen bg-gradient-to-b from-blue-100 to-white">
      {/* Sidebar */}
      <aside className="w-[280px] border-r p-4 bg-white">
        <h2 className="font-semibold mb-3">Sources</h2>
        <FileUpload onFilesUploaded={handleFilesUploaded} />
        <button
          type="button"
          onClick={handleAuthClick}
          disabled={!gapiLoaded || !pickerLoaded || !gisLoaded}
          className="btn btn-primary w-full mt-3 disabled:opacity-50"
        >
          {gapiLoaded && pickerLoaded && gisLoaded ? "Pick from Google Drive" : "Loading…"}
        </button>

        <ul className="mt-4 space-y-1 sources">
          {uploadedDocs.map((doc) => (
            <li
              key={doc.id}
              onClick={() => { setPreviewDoc({ ...doc, page: undefined }); setPreviewOpen(true); }}
              title="Open preview"
            >
              <div className="font-medium truncate">{doc.name}</div>
              <div className="meta">{doc.source} • {doc.mimeType}</div>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="topbar">
          <div className="topbar-inner">
            {/* Left: chats */}
            <div className="topbar-left">
              <button onClick={createNewChat} className="btn btn-primary">New Chat</button>
              <select
                value={activeChatId || ""}
                onChange={(e) => e.target.value && loadChat(e.target.value)}
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

            {/* Center: context */}
            <div className="topbar-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Project</span>
                <select value={selectedProject} onChange={(e) => handleProjectChange(e.target.value)} className="">
                  <option value="">— Select project —</option>
                  {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Instruments</span>
                <div className="chips">
                  {instrumentsForSelectedProject.map((ins) => {
                    const active = selectedInstruments.includes(ins.id);
                    return (
                      <button
                        key={ins.id}
                        type="button"
                        onClick={() => toggleInstrument(ins.id)}
                        className={`chip ${active ? "chip-active" : ""}`}
                        title={active ? "Click to remove" : "Click to add"}
                      >
                        {ins.name}
                      </button>
                    );
                  })}
                  {!instrumentsForSelectedProject.length && (
                    <span className="text-xs text-gray-400">Pick a project first</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: actions */}
            <div className="topbar-right">
              <button type="button" onClick={clearContext} className="btn btn-ghost">Clear</button>
              <button className="btn btn-soft">Save Chat as Note</button>
            </div>
          </div>
        </div>

        {/* Chat surface */}
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
      </main>

      {/* Modal Preview */}
      {previewOpen && previewDoc && (
        <PreviewModal
          file={{
            name: previewDoc.name,
            url: previewDoc.url || "/test.pdf",
            type: previewDoc.mimeType,
            page: previewDoc.page
          }}
          onClose={() => setPreviewOpen(false)}
          renderViewer={(f) => (
            <PdfViewer fileUrl={f.url!} mimeType={f.type} page={f.page} />
          )}
        />
      )}
    </div>
  );
};

export default App;
