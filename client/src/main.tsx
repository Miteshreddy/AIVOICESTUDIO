import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "@/styles/globals.css";

if (import.meta.env.DEV) {
  import("@/store/auth-store").then(({ useAuthStore }) => {
    (window as unknown as { __authStore: typeof useAuthStore }).__authStore = useAuthStore;
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
