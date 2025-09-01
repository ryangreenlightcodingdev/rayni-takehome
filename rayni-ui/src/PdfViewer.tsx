import { Document, Page, pdfjs } from "react-pdf";
import { useEffect, useMemo, useState } from "react";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// ✅ Vite-friendly worker import (uses ?url to resolve as static asset)
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

type PdfViewerProps = {
  fileUrl: string;
  mimeType?: string;
  alt?: string;
  className?: string;
  page?: number; // NEW: allows citations to jump to a page
};

export default function PdfViewer({
  fileUrl,
  mimeType,
  alt,
  className,
  page,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(page ?? 1);

  // Reset page when file changes
  useEffect(() => {
    setCurrentPage(page ?? 1);
  }, [fileUrl, page]);

  const isImage = useMemo(() => {
    if (mimeType?.startsWith("image/")) return true;
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileUrl);
  }, [fileUrl, mimeType]);

  const isPdf = useMemo(() => {
    if (mimeType === "application/pdf") return true;
    return /\.pdf($|\?)/i.test(fileUrl);
  }, [fileUrl, mimeType]);

  if (isImage && !isPdf) {
    // Render image preview
    return (
      <div className={className}>
        <img
          src={fileUrl}
          alt={alt || "Selected image"}
          referrerPolicy="no-referrer"
          style={{ maxWidth: "100%", height: "auto", display: "block" }}
          onError={() => setError("Failed to load image.")}
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // Default: PDF
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
          cMapUrl: "/cmaps/",
          cMapPacked: true,
        }}
      >
        <Page pageNumber={currentPage} />
      </Document>

      {numPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-2 text-sm">
          <button
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>
          <span>
            Page {currentPage} of {numPages}
          </span>
          <button
            disabled={currentPage >= numPages}
            onClick={() => setCurrentPage((p) => Math.min(p + 1, numPages))}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600">Failed to load PDF: {error}</p>
      )}
    </div>
  );
}
