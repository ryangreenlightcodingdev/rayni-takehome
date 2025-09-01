import { Document, Page, pdfjs } from "react-pdf";
import { useMemo, useState } from "react";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// ✅ Vite-friendly worker import (uses ?url to resolve as static asset)
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

type PdfViewerProps = {
  fileUrl: string;
  mimeType?: string; // <-- NEW: helps decide PDF vs image
  alt?: string;
  className?: string;
};

export default function PdfViewer({ fileUrl, mimeType, alt, className }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isImage = useMemo(() => {
    if (mimeType?.startsWith("image/")) return true;
    // Fallback on extension if mimeType not provided
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileUrl);
  }, [fileUrl, mimeType]);

  const isPdf = useMemo(() => {
    if (mimeType === "application/pdf") return true;
    return /\.pdf($|\?)/i.test(fileUrl);
  }, [fileUrl, mimeType]);

  if (isImage && !isPdf) {
    // Render image preview directly
    return (
      <div className={className}>
        {/* Use referrerPolicy to avoid Drive blocking previews in some cases */}
        <img
          src={fileUrl}
          alt={alt || "Selected image"}
          referrerPolicy="no-referrer"
          style={{ maxWidth: "100%", height: "auto", display: "block" }}
          onError={(e) => setError("Failed to load image.")}
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // Default: try as PDF (react-pdf gracefully errors if not a PDF)
  return (
    <div className={className}>
      <Document
        file={fileUrl}
        onLoadSuccess={({ numPages }) => {
          setNumPages(numPages);
          setError(null);
        }}
        onLoadError={(e) => setError(String(e))}
        onSourceError={(e) => setError(String(e))}
        options={{
          // Helps with cross-origin Drive blobs sometimes
          cMapUrl: "/cmaps/",
          cMapPacked: true,
        }}
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page key={`page_${i + 1}`} pageNumber={i + 1} />
        ))}
      </Document>

      {error && (
        <p className="mt-2 text-sm text-red-600">
          Failed to load PDF: {error}
        </p>
      )}
    </div>
  );
}
