import React, { useEffect, useRef } from "react";

type FileLike = { name: string; url?: string; type: string; page?: number };

type Props = {
  file: FileLike;
  onClose: () => void;
  renderViewer: (f: FileLike) => React.ReactNode;
};

export default function PreviewModal({ file, onClose, renderViewer }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        ref={boxRef}
        className="bg-white w-full max-w-5xl h-[86vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${file.name}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold truncate">{file.name}</div>
          <div className="flex items-center gap-2">
            {file.url ? (
              <a className="btn btn-ghost" href={file.url} target="_blank" rel="noreferrer">
                Open in new tab
              </a>
            ) : null}
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-3">
          {renderViewer(file)}
        </div>
      </div>
    </div>
  );
}
