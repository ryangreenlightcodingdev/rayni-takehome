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

  // 🔑 Save Drive access token so we can download file bytes
  const [driveToken, setDriveToken] = useState<string | null>(null);

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
  const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string;
  const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

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
      if (googleObj?.accounts?.oauth2) {
        setGisLoaded(true);
      }
    };

    loadScript();

    // Mock seed data (swap to mock API later)
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
  }, []);

  // ---------- Google Auth + Picker ----------
  const handleAuthClick = async () => {
    if (!gisLoaded) {
      console.error("Google Identity Services not loaded");
      return;
    }

    const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response: any) => {
        if (response.error) {
          console.error("❌ Token error", response);
          return;
        }
        // ✅ keep the token so we can fetch bytes
        setDriveToken(response.access_token);
        openPicker(response.access_token);
      },
    });

    tokenClient.requestAccessToken({ prompt: "consent" });
  };

  const openPicker = (accessToken: string) => {
    if (!(window as any).google || !(window as any).google.picker) {
      console.error("❌ Picker API not loaded");
      return;
    }

    const view = new (window as any).google.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true);

    const picker = new (window as any).google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .setCallback(pickerCallback)
      .build();

    picker.setVisible(true);
  };

  // Helpers to detect native Google files (need export)
  const isGoogleDocType = (mime: string) =>
    mime.startsWith("application/vnd.google-apps.");

  const exportMimeForGoogleType = (mime: string) => {
    // we’ll export everything to PDF to preview
    // (you could branch: sheets→xlsx, slides→pdf, etc.)
    return "application/pdf";
  };

  // Download a Drive file (or export native Google files) and return an Object URL
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
    // Try to keep the most accurate mime
    const outMime =
      isGoogleDocType(mimeType) ? "application/pdf" : blob.type || mimeType;
    return { url, mime: outMime, size: blob.size };
  };

  const pickerCallback = async (data: any) => {
    if (data.action !== (window as any).google.picker.Action.PICKED) return;
    if (!driveToken) {
      console.error("No Drive token found");
      return;
    }

    try {
      const picked = data.docs as any[];
      const driveDocsPromises = picked.map(async (doc) => {
        const { url, mime, size } = await fetchDriveObjectUrl(
          doc.id,
          doc.mimeType,
          driveToken
        );
        return {
          id: doc.id,
          name: doc.name,
          status: "Google Drive" as const,
          source: "google-drive" as const,
          mimeType: mime || doc.mimeType || "application/octet-stream",
          size,
          url, // ✅ object URL that react-pdf / <img> can render
        } as Doc;
      });

      const driveDocs = await Promise.all(driveDocsPromises);
      setUploadedDocs((prev) => [...prev, ...driveDocs]);
    } catch (err) {
      console.error("Drive fetch error:", err);
    }
  };

  // ---------- Local File Upload ----------
  const handleFilesUploaded = (files: any[]) => {
    const localDocs = files.map((file) => ({
      id: file.id,
      name: file.name,
      status: "Local file",
      source: "local" as const,
      mimeType: (file as any).type || "application/octet-stream",
      size: (file as any).size,
      url: (file as any).url, // should be an Object URL from FileUpload.tsx
    }));
    setUploadedDocs((prev) => [...prev, ...localDocs]);
  };

 // ---------- Citation Handler ----------
const handleOpenCitation = (docId: string, page?: number) => {
  const exact = uploadedDocs.find((d) => d.id === docId);
  const fallbackPdf =
    uploadedDocs.find(
      (d) => d.mimeType === "application/pdf" || /\.pdf$/i.test(d.name)
    ) || null;
  const chosen = exact || fallbackPdf || uploadedDocs[0] || null;
  if (chosen) setSelectedDoc({ ...chosen, page });
};
// Types for saved chats
type ChatSummary = { id: string; title: string; messageCount: number; lastUpdated: number | null };
type ChatMsg = {
  id: string; role: "user" | "assistant"; content: string;
  citations?: { label: string; docId: string; page?: number }[];
  reactions?: { up: number; down: number };
  comments?: { id: string; text: string; createdAt: number }[];
};

const [chats, setChats] = useState<ChatSummary[]>([]);
const [activeChatId, setActiveChatId] = useState<string | null>(null);
const [activeChatMessages, setActiveChatMessages] = useState<ChatMsg[]>([]);

// Load chat list once
useEffect(() => {
  fetch("http://localhost:4000/api/chats")
    .then(r => r.json())
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
  setChats(prev => [{ id: chat.id, title: chat.title, messageCount: 0, lastUpdated: null }, ...prev]);
  setActiveChatId(chat.id);
  setActiveChatMessages([]); // empty canvas
};

const loadChat = async (id: string) => {
  setActiveChatId(id);
  const chat = await fetch(`http://localhost:4000/api/chats/${id}`).then(r => r.json());
  setActiveChatMessages(chat.messages || []);
};

  return (
    <div className="flex h-screen bg-gradient-to-b from-blue-100 to-white">
      {/* Left Sidebar: Sources */}
      <div className="w-1/5 border-r p-4 bg-white">
        <h2 className="font-semibold mb-3">Sources</h2>
        <FileUpload onFilesUploaded={handleFilesUploaded} />
        <button
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

      {/* Center: Selector + Chat */}
      <div className="flex flex-col w-3/5 border-r">
        <div className="flex items-center justify-between p-3 border-b bg-white">
        <div className="space-x-2">
  <button onClick={createNewChat} className="px-3 py-1 bg-blue-600 text-white rounded">
    New Chat
  </button>

  {/* Saved chats dropdown */}
  <select
    value={activeChatId || ""}
    onChange={(e) => e.target.value && loadChat(e.target.value)}
    className="border px-2 py-1 rounded"
  >
    <option value="">Open saved chat…</option>
    {chats.map((c) => (
      <option key={c.id} value={c.id}>
        {c.title} {c.messageCount ? `(${c.messageCount})` : ""}
      </option>
    ))}
  </select>

  {/* …keep your Project / Instrument selectors here */}
</div>

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

      {/* Right Sidebar: Preview */}
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
