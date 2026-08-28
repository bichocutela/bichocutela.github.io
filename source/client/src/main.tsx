import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./pages/PromotionsModal.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" }).then((registration) => {
      void registration.update();
    }).catch(() => undefined);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
