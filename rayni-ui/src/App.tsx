import React, { useEffect, useState } from "react";
import FileUpload from "./FileUpload";
import PdfViewer from "./PdfViewer";

type Doc = {
  id: string;
  name: string;
  status: string;
  source: "local" | "google-drive";
  mimeType: string;
  size?: number;
  url?: string;
};

const App: React.FC = () => {
  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [pickerLoaded, setPickerLoaded] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<Doc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
  const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string;
  const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

  // Load gapi client and picker
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
      if (googleObj && googleObj.accounts && googleObj.accounts.oauth2) {
        setGisLoaded(true);
      }
    };

    loadScript();
  }, []);

  // --- Google Auth + Picker ---
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
        const token = response.access_token;
        console.log("✅ Google Access Token:", token);
        openPicker(token);
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

  const pickerCallback = (data: any) => {
    if (data.action === (window as any).google.picker.Action.PICKED) {
      const docs = data.docs;
      const driveDocs = docs.map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        status: "Google Drive",
        source: "google-drive" as const,
        mimeType: doc.mimeType,
        size: doc.sizeBytes,
        url: doc.url || doc.embedUrl || doc.webViewLink,
      }));
      setUploadedDocs((prev) => [...prev, ...driveDocs]);
    }
  };

  // --- Local File Upload ---
  const handleFilesUploaded = (files: any[]) => {
    const localDocs = files.map((file) => ({
      id: file.id,
      name: file.name,
      status: "Local file",
      source: "local" as const,
      mimeType: file.type,
      size: file.size,
      url: file.url,
    }));
    setUploadedDocs((prev) => [...prev, ...localDocs]);
  };

  // --- Chat Handler (Mock) ---
  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;
    const newMsg = { role: "user" as const, text };
    setMessages((prev) => [...prev, newMsg]);

    // Mock AI reply
    setTimeout(() => {
      const aiMsg = {
        role: "ai" as const,
        text: `AI (mock): You said "${text}". Context → Docs=${uploadedDocs.length}`,
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 800);
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

      {/* Center: Chat */}
      <div className="flex flex-col w-3/5 border-r">
        <div className="flex items-center justify-between p-3 border-b bg-white">
          <div className="space-x-2">
            <button className="px-3 py-1 bg-blue-600 text-white rounded">
              New Chat
            </button>
            <span className="text-gray-600">Needle Puncture</span>
          </div>
          <button className="px-3 py-1 border rounded text-sm">
            Save Chat as Note
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg max-w-lg ${
                msg.role === "user"
                  ? "bg-blue-500 text-white ml-auto"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {msg.text}
            </div>
          ))}
        </div>

        <div className="p-3 border-t bg-white flex space-x-2">
          <input
            type="text"
            placeholder="Ask something..."
            className="flex-1 border rounded px-3 py-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSendMessage((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>(
                "input[placeholder='Ask something...']"
              );
              if (input) {
                handleSendMessage(input.value);
                input.value = "";
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Send
          </button>
        </div>
      </div>

      {/* Right Sidebar: Preview */}
      <div className="w-1/5 p-4 bg-white">
        <h2 className="font-semibold mb-3">Preview</h2>
        {selectedDoc ? (
          selectedDoc.mimeType === "application/pdf" ? (
            <div className="h-[80vh] overflow-y-auto border">
              <PdfViewer fileUrl={selectedDoc.url || "/test.pdf"} />
            </div>
          ) : (
            <div className="text-gray-600 text-sm">Preview not available</div>
          )
        ) : (
          <p className="text-gray-400 text-sm">Select a document to preview</p>
        )}
      </div>
    </div>
  );
};

export default App;
