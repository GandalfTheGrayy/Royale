import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import "./styles.css";
import "./typography.css";
import "./readability.css";
import "./mobile-gameplay.css";
import "./responsive-game-shell.css";
import "./lobby-premium.css";
import { AuthProvider } from "./auth/auth-client";
import MetaResultToast from "./components/MetaResultToast";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <App />
        <MetaResultToast />
      </AuthProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
