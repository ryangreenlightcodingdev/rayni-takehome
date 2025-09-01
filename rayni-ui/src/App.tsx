import React, { useMemo, useState } from "react";
import PdfViewer from "./PdfViewer";
// If you already have these, keep them. Otherwise you can remove these imports.
// import FileUpload from "./FileUpload";
// import PreviewModal from "./PreviewModal";

type DocItem = {
  id: string;
  name: string;
  status: string;
  source: "local" | "google-drive" | "uploaded";
  mimeType?: string;
  size?: number | string;
  url: string;
};

const App: React.FC = () => {
  const [uploadedDocs, setUploadedDocs] = useState<DocItem[]>([]);
  const [driveDocsState, setDriveDocsState] = useState<DocItem[]>([]);
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null);

  // Example local upload handler (use your existing FileUpload if you have one)
  const handleLocalFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const mapped: DocItem[] = arr.map((f, i) => ({
      id: `${f.name}-${f.size}-${i}-${Date.now()}`,
      name: f.name,
      status: "Local file",
      source: "local",
      mimeType: f.type,
      size: f.size,
      url: URL.createObjectURL(f), // blob URL for preview
    }));
    setUploadedDocs((prev) => [...mapped, ...prev]);
  };

  /**
   * ✅ Call this from your Google Picker success callback.
   * For example, wherever you receive `docs` from the picker, do:
   *    window.onDrivePick(docs)
   * We also expose it on window below to make it easy to wire from the picker code.
   */
  const handleDrivePick = (docs: any[]) => {
    const driveDocs: DocItem[] = docs.map((doc: any) => ({
      id: doc.id,
      name: doc.name,
      status: "Selected from Google Drive",
      source: "google-drive",
      mimeType: doc.mimeType,
      size: doc.sizeBytes,
      // Prefer a direct link if present, otherwise fallback to view link, then to uc? export
      url: doc.url || doc.webViewLink || `https://drive.google.com/uc?id=${doc.id}&export=download`,
    }));
    setDriveDocsState((prev) => [...driveDocs, ...prev]);
  };

  // Expose for easy wiring from your picker script (optional)
  (window as any).onDrivePick = handleDrivePick;

  const allDocs = useMemo<DocItem[]>(
    () => [...driveDocsState, ...uploadedDocs],
    [driveDocsState, uploadedDocs]
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginBottom: 16 }}>Docs & Previews</h1>

      {/* Quick local upload input for testing (remove if you already have FileUpload component) */}
      <div style={{ marginBottom: 24, display: "flex", gap: 12, alignItems: "center" }}>
        <input
          type="file"
          accept=".pdf,image/*"
          multiple
          onChange={(e) => {
            if (e.target.files) handleLocalFiles(e.target.files);
          }}
        />
        <button
          onClick={() => {
            // Example: test a public PDF in /public/test.pdf
            setUploadedDocs((prev) => [
              {
                id: `public-test-${Date.now()}`,
                name: "Public test.pdf",
                status: "Public asset",
                source: "uploaded",
                mimeType: "application/pdf",
                url: "/test.pdf",
              },
              ...prev,
            ]);
          }}
        >
          Add /test.pdf from public
        </button>
        <button
          onClick={() => {
            // Example: test an external image
            setUploadedDocs((prev) => [
              {
                id: `ext-img-${Date.now()}`,
                name: "External image.jpg",
                status: "External",
                source: "uploaded",
                mimeType: "image/jpeg",
                url: "https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d",
              },
              ...prev,
            ]);
          }}
        >
          Add sample external image
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
        <div>
          <h2 style={{ marginBottom: 8 }}>Documents</h2>
          {allDocs.length === 0 ? (
            <p>No documents yet. Upload locally or call your Drive picker and pass its docs to <code>window.onDrivePick(docs)</code>.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {allDocs.map((doc) => (
                <li
                  key={doc.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    padding: 12,
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {doc.status} · {doc.source}
                      {doc.mimeType ? ` · ${doc.mimeType}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 14 }}
                    >
                      Open
                    </a>
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      style={{
                        fontSize: 14,
                        border: "1px solid #d1d5db",
                        padding: "6px 10px",
                        borderRadius: 6,
                        cursor: "pointer",
                        background: "white",
                      }}
                    >
                      Preview
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 style={{ marginBottom: 8 }}>Preview</h2>
          <div
            style={{
              minHeight: 420,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 12,
            }}
          >
            {previewDoc ? (
              <PdfViewer
                fileUrl={previewDoc.url}
                mimeType={previewDoc.mimeType}
                alt={previewDoc.name}
              />
            ) : (
              <p style={{ color: "#6b7280" }}>Select a document to preview.</p>
            )}
          </div>
        </div>
      </div>

      {/* If you already have a modal, you can swap the inline preview above with your modal: 
          <PreviewModal open={!!previewDoc} onClose={() => setPreviewDoc(null)}>
            {previewDoc && (
              <PdfViewer fileUrl={previewDoc.url} mimeType={previewDoc.mimeType} alt={previewDoc.name} />
            )}
          </PreviewModal>
      */}
    </div>
  );
};

export default App;
