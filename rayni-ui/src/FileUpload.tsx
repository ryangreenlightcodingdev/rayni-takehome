// src/FileUpload.tsx
import React, { useCallback, useMemo, useRef, useState } from "react";

type FileStatus = "queued" | "uploaded" | "indexed";

export interface UploadedFile {
  id: string;
  name: string;
  type: string;      // MIME
  size: number;
  url: string;       // Object URL (for previews)
  status: FileStatus;
}

type Props = {
  onFilesUploaded: (files: UploadedFile[]) => void;
};

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt", ".jpg", ".jpeg", ".png"];
const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  "text/plain",
  "image/jpeg",
  "image/png",
];

const isAllowed = (file: File) => {
  const name = file.name || "";
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  const type = file.type || "application/octet-stream";
  return ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_MIME.includes(type);
};

const prettyBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const FileUpload: React.FC<Props> = ({ onFilesUploaded }) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleAccepted = useCallback(
    (nativeFiles: File[]) => {
      // map to our UploadedFile model
      const newItems: UploadedFile[] = nativeFiles.map((f) => ({
        id: crypto.randomUUID(),
        name: f.name,
        type: f.type || "application/octet-stream",
        size: f.size,
        url: URL.createObjectURL(f),
        status: "queued",
      }));

      // Push to our local list for status display
      setFiles((prev) => [...prev, ...newItems]);
      // Notify parent (App) so it can add them to Sources
      onFilesUploaded(newItems);

      // Simulate upload + indexing pipeline
      newItems.forEach((item, idx) => {
        // uploaded
        setTimeout(() => {
          setFiles((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, status: "uploaded" } : p))
          );
        }, 600 + idx * 300);
        // indexed
        setTimeout(() => {
          setFiles((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, status: "indexed" } : p))
          );
        }, 1400 + idx * 300);
      });
    },
    [onFilesUploaded]
  );

  const handleRejected = useCallback((nativeFiles: File[]) => {
    const msgs = nativeFiles.map((f) => {
      const name = f.name || "Unnamed file";
      const dot = name.lastIndexOf(".");
      const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "(no extension)";
      const type = f.type || "application/octet-stream";
      return `Unsupported file type: ${ext} (${type}) — Allowed: PDF, DOCX, PPTX, TXT, JPG, PNG.`;
    });
    setErrors((prev) => [...prev, ...msgs]);
  }, []);

  const splitByValidity = useCallback((fileList: FileList | null) => {
    if (!fileList) return { accepted: [], rejected: [] as File[] };
    const arr = Array.from(fileList);
    const accepted: File[] = [];
    const rejected: File[] = [];
    arr.forEach((f) => (isAllowed(f) ? accepted.push(f) : rejected.push(f)));
    return { accepted, rejected };
  }, []);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      const { accepted, rejected } = splitByValidity(fileList);
      if (accepted.length) handleAccepted(accepted);
      if (rejected.length) handleRejected(rejected);
      // clear the input to allow uploading the same file again if desired
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleAccepted, handleRejected, splitByValidity]
  );

  // Drag & drop
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className="p-4 border-2 border-dashed border-gray-400 rounded-xl text-center"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        id="fileInput"
        onChange={(e) => handleFiles(e.target.files)}
        accept={ALLOWED_EXTENSIONS.join(",")}
      />

      <label
        htmlFor="fileInput"
        className="cursor-pointer text-blue-600 font-semibold block"
        title="Allowed: PDF, DOCX, PPTX, TXT, JPG, PNG"
      >
        Click or drag files here to upload
      </label>
      <div className="text-xs text-gray-500 mt-1">
        Allowed: PDF, DOCX, PPTX, TXT, JPG, PNG
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mt-3 text-left">
          {errors.map((err, i) => (
            <div
              key={i}
              className="mb-2 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700"
            >
              {err}
            </div>
          ))}
        </div>
      )}

      {/* Pipeline statuses */}
      <ul className="mt-4 space-y-2">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex items-center justify-between gap-2 rounded-md bg-gray-100 p-2"
            title={`${file.type} • ${prettyBytes(file.size)}`}
          >
            <span className="truncate">{file.name}</span>
            <span
              className={
                file.status === "queued"
                  ? "text-yellow-600"
                  : file.status === "uploaded"
                  ? "text-blue-600"
                  : "text-green-600"
              }
            >
              {file.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FileUpload;
