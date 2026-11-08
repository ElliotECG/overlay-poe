"use strict";

import { app, systemPreferences } from "electron";
import { uIOhook } from "uiohook-napi";
import os from "node:os";
import { startServer, eventPipe, server } from "./server";
import { Logger } from "./RemoteLogger";
import { GameWindow } from "./windowing/GameWindow";
import { OverlayWindow } from "./windowing/OverlayWindow";
import { GameConfig } from "./host-files/GameConfig";
import { Shortcuts } from "./shortcuts/Shortcuts";
import { AppUpdater } from "./AppUpdater";
import { AppTray } from "./AppTray";
import { OverlayVisibility } from "./windowing/OverlayVisibility";
import { GameLogWatcher } from "./host-files/GameLogWatcher";
import { HttpProxy } from "./proxy";
import { installExtension, VUEJS_DEVTOOLS } from "electron-devtools-installer";
import { FileWriter } from "./host-files/FileWriter";
import { enableBrowserAdblock } from "./adblock";
import { setupAtziriData } from "./atziri-data";
import { setupAtziriAutostart, isAutostartEnabled } from "./atziri-autostart";
import { setupAtziriDeathRecap } from "./atziri-death-recap";

if (!app.requestSingleInstanceLock()) {
  app.exit();
}

if (process.platform !== "darwin") {
  app.disableHardwareAcceleration();
}
app.enableSandbox();
let tray: AppTray;

// Atziri Exchange: quit cleanly when Windows shuts down or restarts.
// Without this, the keyboard hook could still be running while Windows
// kills the app, which showed a "breakpoint reached" (0x80000003) error box.
let hookStopped = false;
function stopKeyboardHook() {
  if (hookStopped) return;
  hookStopped = true;
  try {
    uIOhook.stop();
  } catch {
    // already stopped
  }
}
app.on("will-quit", stopKeyboardHook);
app.on("browser-window-created", (_e, win) => {
  win.on("session-end", () => {
    stopKeyboardHook();
    app.exit(0);
  });
});

(async () => {
  if (process.platform === "darwin") {
    async function ensureAccessibilityPermission(): Promise<boolean> {
      if (systemPreferences.isTrustedAccessibilityClient(false)) return true;

      // Trigger the system prompt
      systemPreferences.isTrustedAccessibilityClient(true);

      const maxWaitTime = 15000; // 15 seconds
      const startTime = Date.now();

      return await new Promise((resolve) => {
        const interval = setInterval(() => {
          if (systemPreferences.isTrustedAccessibilityClient(false)) {
            clearInterval(interval);
            resolve(true);
          }

          // Stop waiting if time runs out
          if (Date.now() - startTime > maxWaitTime) {
            clearInterval(interval);
            resolve(false);
          }
        }, 1000);
      });
    }
    const hasPermission = await ensureAccessibilityPermission();
    if (!hasPermission) {
      console.warn("Accessibility permission not granted, exiting");
      app.quit();
      return;
    }
    console.log("Accessibility permission granted, starting app");
  }

  app.on("ready", async () => {
    tray = new AppTray(eventPipe);
    const logger = new Logger(eventPipe);
    const gameConfig = new GameConfig(eventPipe, logger);
    const poeWindow = new GameWindow();
    // Atziri Exchange: the overlay closes itself when the game is closed
    // (unless "start with the game" is on: it then waits for the next game)
    poeWindow.onGameClosed(() => {
      if (isAutostartEnabled()) return;
      logger.write("info [Atziri] game closed, quitting the overlay.");
      app.quit();
    });
    const appUpdater = new AppUpdater(eventPipe);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _httpProxy = new HttpProxy(server, logger);
    const fileWriter = new FileWriter(eventPipe, logger);
    const gameLogWatcher = new GameLogWatcher(eventPipe, logger, fileWriter);
    // Atziri Exchange: block ads in the Shift + Space browser tab
    enableBrowserAdblock(logger);

    if (process.env.VITE_DEV_SERVER_URL) {
      try {
        await installExtension(VUEJS_DEVTOOLS);
        logger.write("info Vue Devtools installed");
      } catch (error) {
        logger.write(`error installing Vue Devtools: ${error}`);
        console.log(`error installing Vue Devtools: ${error}`);
      }
    }
    process.addListener("uncaughtException", (err) => {
      logger.write(`error [uncaughtException] ${err.message}, ${err.stack}`);
    });
    process.addListener("unhandledRejection", (reason) => {
      logger.write(`error [unhandledRejection] ${(reason as Error).stack}`);
    });

    setTimeout(
      async () => {
        const overlay = new OverlayWindow(eventPipe, logger, poeWindow);
        // eslint-disable-next-line no-new
        new OverlayVisibility(eventPipe, overlay, gameConfig);
        const shortcuts = await Shortcuts.create(
          logger,
          overlay,
          poeWindow,
          gameConfig,
          eventPipe,
        );
        eventPipe.onEventAnyClient(
          "CLIENT->MAIN::update-host-config",
          (cfg) => {
            overlay.updateOpts(
              cfg.overlayKey,
              cfg.windowTitle,
              cfg.hideOverlayOnBlur,
            );
            shortcuts.updateActions(
              cfg.shortcuts,
              cfg.stashScroll,
              cfg.logKeys,
              cfg.restoreClipboard,
              cfg.language,
            );
            shortcuts.updateDelay(cfg.initialDelay);
            gameLogWatcher.restart(cfg.clientLog ?? "", cfg.readClientLog);
            gameConfig.readConfig(cfg.gameConfig ?? "");
            appUpdater.checkAtStartup();
            tray.overlayKey = cfg.overlayKey;
            fileWriter.restart(cfg.libraryAlpha, cfg.libraryOutputPath);
          },
        );
        uIOhook.start();
        console.log("uIOhook started");
        // Atziri Exchange: item/mod lists kept up to date from GitHub
        setupAtziriData(server, logger);
        setupAtziriAutostart(server);
        // Atziri Exchange: video of the last seconds before each death
        // (saved by NVIDIA Instant Replay)
        setupAtziriDeathRecap(server, logger);
        const port = await startServer(appUpdater, logger);
        // TODO: move up (currently crashes)
        logger.write(`info ${os.type()} ${os.release} / v${app.getVersion()}`);
        overlay.loadAppPage(port);
        tray.serverPort = port;
      },
      // fixes(linux): window is black instead of transparent
      process.platform === "linux" ? 1000 : 0,
    );
  });
})();
