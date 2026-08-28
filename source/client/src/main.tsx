import { createRoot } from "react-dom/client";
import App from "./App";
import AboutFooter from "./components/AboutFooter";
import "./index.css";
import "./pages/PromotionsModal.css";
import "./lib/barcodeEnhancer.css";
import "./lib/barcodeEnhancer";
import "./components/AboutFooter.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" }).then((registration) => {
      void registration.update();
    }).catch(() => undefined);
  });
}

createRoot(document.getElementById("root")!).render(<App />);

const aboutRoot = document.createElement("div");
aboutRoot.id = "nrd-about-root";
document.getElementById("root")?.insertAdjacentElement("afterend", aboutRoot);
createRoot(aboutRoot).render(<AboutFooter />);
