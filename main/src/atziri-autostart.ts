// Atziri Exchange: "start with the game" option.
//
// The overlay starts silently with Windows (tray icon only) and wakes up when
// Path of Exile 2 opens. While this option is on, closing the game does not
// quit the overlay, so it is ready for the next game session.
import { app } from "electron";
import type { Server, IncomingMessage, ServerResponse } from "http";

const AUTOSTART_ARG = "--atziri-autostart";

export function isAutostartEnabled(): boolean {
  if (process.platform !== "win32") return false;
  try {
    return app.getLoginItemSettings({ args: [AUTOSTART_ARG] }).openAtLogin;
  } catch {
    return false;
  }
}

function setAutostart(on: boolean) {
  if (process.platform !== "win32") return;
  app.setLoginItemSettings({
    openAtLogin: on,
    path: process.execPath,
    args: [AUTOSTART_ARG],
  });
}

/** Routes /atziri-autostart (status) and /atziri-autostart?on=0|1 (POST) */
export function setupAtziriAutostart(server: Server) {
  server.prependListener("request", (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "";
    if (!url.startsWith("/atziri-autostart")) return;
    (req as IncomingMessage & { atziriHandled?: boolean }).atziriHandled = true;
    if (req.method === "POST") {
      setAutostart(!url.includes("on=0"));
    }
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        supported: process.platform === "win32",
        enabled: isAutostartEnabled(),
      }),
    );
  });
}
