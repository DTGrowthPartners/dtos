import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { listenForegroundPush } from "./lib/push";

createRoot(document.getElementById("root")!).render(<App />);

// PWA: registrar el service worker (FCM push en background + instalabilidad)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/firebase-messaging-sw.js")
      .then(() => listenForegroundPush())
      .catch(() => {});
  });
}
