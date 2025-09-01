import { pdfjs } from "react-pdf";

// ✅ Point to the worker inside node_modules
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.js",
  import.meta.url
).toString();
