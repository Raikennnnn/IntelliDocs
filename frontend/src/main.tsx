
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { installChunkLoadRecovery } from "./app/lib/chunkLoadRecovery";

installChunkLoadRecovery();

createRoot(document.getElementById("root")!).render(<App />);
  