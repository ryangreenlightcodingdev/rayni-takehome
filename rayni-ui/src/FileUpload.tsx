import React, { useState } from "react";

type FileStatus = "queued" | "uploaded" | "indexed";

interface UploadedFile {
  id: string;
  name: string;
  status: FileStatus;
}

const FileUpload: React.FC<{ onFilesUploaded: (files: UploadedFile[]) => void }> = ({ onFilesUploaded }) => {
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const handleFiles = (selected: FileList | null) => {
    if (!selected) return;

    const newFiles: UploadedFile[] = Array.from(selected).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      status: "queued",
    }));

    setFiles((prev) => [...prev, ...newFiles]);
    onFilesUploaded(newFiles);

    // Simulate upload + indexing
    newFiles.forEach((f, idx) => {
      setTimeout(() => {
        setFiles((prev) =>
          prev.map((file) =>
            file.id === f.id ? { ...file, status: "uploaded" } : file
          )
        );
      }, 1000 + idx * 500);

      setTimeout(() => {
        setFiles((prev) =>
          prev.map((file) =>
            file.id === f.id ? { ...file, status: "indexed" } : file
          )
        );
      }, 2000 + idx * 500);
    });
  };

  return (
    <div className="p-4 border-2 border-dashed border-gray-400 rounded-xl text-center">
      <input
        type="file"
        multiple
        className="hidden"
        id="fileInput"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <label
        htmlFor="fileInput"
        className="cursor-pointer text-blue-600 font-semibold"
      >
        Click or drag files here to upload
      </label>

      <ul className="mt-4 space-y-2">
        {files.map((file) => (
          <li
            key={file.id}
            className="flex justify-between p-2 bg-gray-100 rounded-md"
          >
            <span>{file.name}</span>
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
