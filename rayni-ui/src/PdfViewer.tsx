import { Document, Page, pdfjs } from "react-pdf";
import { useState } from "react";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// ✅ Vite-friendly worker import (uses ?url to resolve as static asset)
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

type PdfViewerProps = {
  fileUrl: string;
};

export default function PdfViewer({ fileUrl }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Document
        file={fileUrl}
        onLoadSuccess={({ numPages }) => {
          setNumPages(numPages);
          setError(null);
        }}
        onLoadError={(e) => setError(String(e))}
        onSourceError={(e) => setError(String(e))}
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
