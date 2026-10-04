import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { resolvePlatform } from "./discord";
import { watchMiniWindow } from "./miniWindow";

// Stamped before render, not in a component: the mobile safe-area padding in player.css keys
// off this, and applying it after mount would show one frame of the layout tucked under
// Discord's own floating controls.
document.documentElement.dataset.platform = resolvePlatform();
// Likewise, which minimised layout a phone's small window gets (if it is one): see miniWindow.ts.
watchMiniWindow(resolvePlatform());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
