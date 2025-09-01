import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

type PreviewModalProps = {
  file: { name: string; url?: string; type: string };
  onClose: () => void;
};

export default function PreviewModal({ file, onClose }: PreviewModalProps) {
  const [numPages, setNumPages] = useState<number>(0);

  const handleLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-4/5 h-4/5 overflow-auto relative p-4">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Close
        </button>

        <h2 className="text-lg font-bold mb-4">{file.name}</h2>

        {/* Preview Different File Types */}
        {file.type.includes("pdf") && (
          <Document file={file.url} onLoadSuccess={handleLoadSuccess}>
            {Array.from(new Array(numPages), (el, index) => (
              <Page key={`page_${index + 1}`} pageNumber={index + 1} />
            ))}
          </Document>
        )}

        {file.type.includes("image") && (
          <img src={file.url} alt={file.name} className="max-h-[70vh] mx-auto" />
        )}

        {file.type.includes("text") && (
          <iframe src={file.url} className="w-full h-[70vh]" title={file.name} />
        )}

        {!file.type.includes("pdf") &&
          !file.type.includes("image") &&
          !file.type.includes("text") && (
            <p className="text-gray-600">Preview not available for this file type.</p>
          )}
      </div>
    </div>
  );
}
