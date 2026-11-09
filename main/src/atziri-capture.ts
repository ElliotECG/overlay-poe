// My Ritualist Overlay: "hide the overlay from captures" option.
//
// On: the overlay window is left out of every screen capture, so the Death
// Recap videos (NVIDIA Instant Replay) show only the game; it is then also
// invisible in streams (OBS, Discord screen sharing) and screenshots.
// Off: viewers of a stream see the overlay; it also shows in a Death Recap
// video when it is open at the moment of death.
import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import type { Server, IncomingMessage, ServerResponse } from "http";

const settingsFile = () => path.join(app.getPath("userData"), "capture.json");

/** On unless turned off in the Ritualist settings */
export function isHiddenFromCapture(): boolean {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), "utf8")).hidden !== false;
  } catch {
    return true;
  }
}

function saveHidden(hidden: boolean) {
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify({ hidden }));
  } catch {
    // not important
  }
}

/**
 * Routes /atziri-capture (status) and /atziri-capture?hidden=0|1 (POST);
 * apply() changes the overlay window right away
 */
export function setupAtziriCapture(server: Server, apply: (hidden: boolean) => void) {
  server.prependListener("request", (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "";
    if (!url.startsWith("/atziri-capture")) return;
    (req as IncomingMessage & { atziriHandled?: boolean }).atziriHandled = true;
    if (req.method === "POST") {
      const hidden = !url.includes("hidden=0");
      saveHidden(hidden);
      apply(hidden);
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ hidden: isHiddenFromCapture() }));
  });
}
