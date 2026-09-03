import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { DesktopI18nProvider } from "./desktop-i18n";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DesktopI18nProvider>
      <App />
    </DesktopI18nProvider>
  </StrictMode>,
);
