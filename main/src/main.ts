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
import { setupAtziriAutostart, isAutostartEnabled, launchedAtLogin } from "./atziri-autostart";
import { DesktopWindow } from "./windowing/DesktopWindow";
import { setupAtziriCapture } from "./atziri-capture";
import { setupAtziriDeathRecap } from "./atziri-death-recap";
import { setupAtziriPob, pobCharacter } from "./atziri-pob";
import { setupAtziriDiscord, overlayLeague } from "./atziri-discord";
import path from "node:path";

// My Ritualist Overlay: the app was called "Atziri Exchange" before. Electron
// names its data folder after the app, so the old folder is kept on purpose:
// settings, theme, favorites, history and updated lists stay where they are.
app.setPath("userData", path.join(app.getPath("appData"), "Atziri Exchange"));

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
    poeWindow.trackGameOpen();
    // My Ritualist Overlay: the hub in a normal window, without the game
    const desktop = new DesktopWindow();
    tray.onOpen = () => { desktop.open(); };
    // launched again (desktop shortcut) while already running: show the window
    app.on("second-instance", () => { desktop.open(); });
    // Atziri Exchange: the overlay closes itself when the game is closed
    // (unless "start with the game" is on: it then waits for the next game,
    // or the desktop window is open)
    poeWindow.onGameClosed(() => {
      if (isAutostartEnabled() || desktop.isOpen) return;
      logger.write("info [Atziri] game closed, quitting the overlay.");
      app.quit();
    });
    // closing the desktop window without the game quits the app too
    desktop.onClosed(() => {
      if (poeWindow.isGameOpen || isAutostartEnabled()) return;
      logger.write("info [Ritualist] desktop window closed without the game, quitting.");
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
        // My Ritualist Overlay: show the overlay in streams, or not
        setupAtziriCapture(server, (hidden) => { overlay.setHiddenFromCapture(hidden); });
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
        // My Ritualist Overlay: compare an item with the build in Path of Building
        setupAtziriPob(server, logger);
        // My Ritualist Overlay: "Playing My Ritualist Overlay" on Discord
        setupAtziriDiscord(server, logger, {
          isGameOpen: () => poeWindow.isGameOpen,
          character: pobCharacter,
          league: overlayLeague,
        });
        const port = await startServer(appUpdater, logger);
        // TODO: move up (currently crashes)
        logger.write(`info ${os.type()} ${os.release} / v${app.getVersion()}`);
        overlay.loadAppPage(port);
        tray.serverPort = port;
        desktop.setPort(port);
        // started by the user while the game is not running: open the
        // desktop window (the overlay needs a few seconds to find the game)
        if (!launchedAtLogin()) {
          setTimeout(() => {
            if (!poeWindow.isGameOpen) desktop.open();
          }, 4000);
        }
      },
      // fixes(linux): window is black instead of transparent
      process.platform === "linux" ? 1000 : 0,
    );
  });
})();
