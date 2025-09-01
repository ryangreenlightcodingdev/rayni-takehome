import React, { useEffect, useState } from "react";
import FileUpload from "./FileUpload";
import PreviewModal from "./PreviewModal";
import PdfViewer from "./PdfViewer";

const App: React.FC = () => {
  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [pickerLoaded, setPickerLoaded] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const [previewFile, setPreviewFile] = useState<any | null>(null);

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
  const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string;
  const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

  // Load gapi client and picker; detect Google Identity Services
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
  }, [API_KEY]);

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
    if (!(window as any).google?.picker) {
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
      console.log("✅ Files selected from Google Drive:", docs);

      const driveDocs = docs.map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        status: "Selected from Google Drive",
        source: "google-drive",
        mimeType: doc.mimeType,
        size: doc.sizeBytes,
        // Note: To preview Drive files, you’ll likely need to fetch a download URL with your backend.
      }));

      setUploadedDocs((prev) => [...prev, ...driveDocs]);
      setSelectedFiles(docs);
    }
  };

  const handleFilesUploaded = (files: any[]) => {
    setUploadedDocs((prev) => [...prev, ...files]);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">
        Google Drive Integration + File Upload
      </h1>

      {/* PDF Preview Test */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">PDF Preview Test</h2>
        {/* ✅ Place test.pdf inside /public */}
        <PdfViewer fileUrl="/test.pdf.pdf" />
        {/* Or use a remote file with CORS enabled:
            <PdfViewer fileUrl="https://www.orimi.com/pdf-test.pdf" />
        */}
      </div>

      {/* File Upload */}
      <FileUpload onFilesUploaded={handleFilesUploaded} />

      {/* Google Drive Picker */}
      <div className="mt-6">
        <button
          onClick={handleAuthClick}
          disabled={!gapiLoaded || !pickerLoaded || !gisLoaded}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 disabled:opacity-50"
        >
          {gapiLoaded && pickerLoaded && gisLoaded
            ? "Pick a File from Google Drive"
            : "Loading..."}
        </button>
      </div>

      {/* Show unified uploaded docs list */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">All Documents</h2>
        {uploadedDocs.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            No documents yet. Upload files or pick from Google Drive.
          </p>
        ) : (
          <ul className="space-y-2">
            {uploadedDocs.map((doc, index) => (
              <li
                key={`${doc.source}-${doc.id || index}`}
                className="p-3 border rounded bg-white cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() =>
                  setPreviewFile({
                    name: doc.name,
                    url: doc.url || doc.downloadUrl || doc.webViewLink,
                    type: doc.mimeType || doc.type,
                  })
                }
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{doc.name}</span>
                    <span className="ml-2 text-sm text-gray-500">
                      ({doc.status})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400">
                      {doc.source === "google-drive" ? "🌐" : "💾"}
                    </span>
                    <span className="text-sm text-blue-600">👁️ Preview</span>
                  </div>
                </div>
                {doc.mimeType && (
                  <div className="text-xs text-gray-500 mt-1">
                    Type: {doc.mimeType}
                    {doc.size &&
                      ` • Size: ${(parseInt(doc.size) / 1024).toFixed(1)} KB`}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
};

export default App;
