import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { resolvePlatform } from "./discord";

// Stamped before render, not in a component: the mobile safe-area padding in player.css keys
// off this, and applying it after mount would show one frame of the layout tucked under
// Discord's own floating controls.
document.documentElement.dataset.platform = resolvePlatform();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
