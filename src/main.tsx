import { createRoot } from "react-dom/client";
import { startTransition } from "react";
import App from "./App.tsx";
import "./index.css";

// Use startTransition to mark app rendering as non-urgent
// This allows browser to prioritize other critical work
const root = createRoot(document.getElementById("root")!);

startTransition(() => {
  root.render(<App />);
});
