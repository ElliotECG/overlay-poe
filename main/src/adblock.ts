// Atziri Exchange: ad and tracker blocking for the "Navigateur" tab.
// Applied only to the browser tab's own session, so the overlay UI, the
// trade API and the price requests are never filtered.
import { app, session } from "electron";
import { promises as fs } from "fs";
import * as path from "path";
import { ElectronBlocker } from "@ghostery/adblocker-electron";
import type { Logger } from "./RemoteLogger";

export const BROWSER_PARTITION = "persist:atziri-browser";

export async function enableBrowserAdblock(logger: Logger) {
  const cachePath = path.join(app.getPath("userData"), "adblock-engine.bin");
  try {
    const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
      path: cachePath,
      read: fs.readFile,
      write: fs.writeFile,
    });
    blocker.enableBlockingInSession(session.fromPartition(BROWSER_PARTITION));
    logger.write("info [Adblock] Ads and trackers blocked in the browser tab.");
  } catch (e) {
    logger.write(`error [Adblock] Could not start: ${(e as Error).message}`);
  }
}
