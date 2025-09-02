// src/PdfViewer.tsx
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// ✅ Vite-friendly PDF.js worker (fixes “Failed to fetch dynamically imported module”)
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

type Props = {
  fileUrl: string;
  mimeType: string;
  /** 1-based page number to jump to (optional) */
  page?: number;
};

export default function PdfViewer({ fileUrl, mimeType, page }: Props) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  // if a page is requested before numPages is known, remember it
  const pendingPageRef = useRef<number | null>(null);

  // measure container to make Page responsive
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(420);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setWidth(Math.max(200, el.clientWidth - 16)); // some padding
    });
    ro.observe(el);
    setWidth(Math.max(200, el.clientWidth - 16));
    return () => ro.disconnect();
  }, []);

  // When parent asks to jump to a page
  useEffect(() => {
    if (!page) return;
    // if we don't know numPages yet, defer
    if (!numPages) {
      pendingPageRef.current = page;
      return;
    }
    const clamped = Math.min(Math.max(1, page), numPages);
    setCurrentPage(clamped);
    // scroll this component to top (nice UX when jumping)
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [page, numPages]);

  const onLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setError(null);
    // apply any deferred page jump
    if (pendingPageRef.current) {
      const p = Math.min(Math.max(1, pendingPageRef.current), n);
      setCurrentPage(p);
      pendingPageRef.current = null;
    } else {
      // keep currentPage within range
      setCurrentPage((p) => Math.min(Math.max(1, p), n));
    }
  };

  if (mimeType.startsWith("image/")) {
    return (
      <div ref={containerRef} className="h-[75vh] overflow-auto">
        <img src={fileUrl} alt="" className="max-w-full h-auto rounded" />
      </div>
    );
  }

  if (mimeType !== "application/pdf") {
    return (
      <div className="text-sm text-gray-600 p-3">
        Preview not available for this file type.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[75vh]">
      {/* Controls */}
      <div className="flex items-center justify-between text-sm mb-2">
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            Prev
          </button>
          <span>
            Page{" "}
            <input
              className="w-14 border rounded px-1 py-0.5 text-center"
              value={currentPage}
              onChange={(e) =>
                setCurrentPage(
                  Math.min(
                    Math.max(1, Number(e.target.value) || 1),
                    Math.max(1, numPages || 1)
                  )
                )
              }
            />{" "}
            / {numPages || "—"}
          </span>
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() =>
              setCurrentPage((p) => Math.min(numPages || 1, p + 1))
            }
            disabled={!numPages || currentPage >= numPages}
          >
            Next
          </button>
        </div>
      </div>

      {/* PDF */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto border rounded p-2 bg-white"
      >
        <Document
          file={fileUrl}
          onLoadSuccess={onLoadSuccess}
          onLoadError={(e) => setError(String(e))}
          onSourceError={(e) => setError(String(e))}
          loading={<div className="text-sm text-gray-500 p-2">Loading PDF…</div>}
          error={<div className="text-sm text-red-600 p-2">{error}</div>}
          noData={<div className="text-sm text-gray-500 p-2">No PDF</div>}
        >
          {!!numPages && (
            <Page
              pageNumber={currentPage}
              width={width}
              renderAnnotationLayer
              renderTextLayer
            />
          )}
        </Document>
      </div>
    </div>
  );
}
