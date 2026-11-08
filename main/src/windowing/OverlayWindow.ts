import path from "path";
import { BrowserWindow, dialog, shell, Menu } from "electron";
import {
  OverlayController,
  OVERLAY_WINDOW_OPTS,
} from "electron-overlay-window";
import type { ServerEvents } from "../server";
import type { Logger } from "../RemoteLogger";
import type { GameWindow } from "./GameWindow";

export class OverlayWindow {
  public isInteractable = false;
  public wasUsedRecently = true;
  private window?: BrowserWindow;
  private overlayKey: string = "Shift + Space";
  private isOverlayKeyUsed = false;
  private shouldShowOverlay = true;
  private hideOverlayOnBlur = false;

  constructor(
    private server: ServerEvents,
    private logger: Logger,
    private poeWindow: GameWindow,
  ) {
    this.server.onEventAnyClient(
      "OVERLAY->MAIN::focus-game",
      this.assertGameActive,
    );
    this.poeWindow.on("active-change", this.handlePoeWindowActiveChange);
    this.poeWindow.onAttach(this.handleOverlayAttached);

    this.server.onEventAnyClient("CLIENT->MAIN::used-recently", (e) => {
      this.wasUsedRecently = e.isOverlay;
    });

    if (process.argv.includes("--no-overlay")) return;

    this.server.onEventAnyClient("OVERLAY->MAIN::render-state", (e) => {
      this.shouldShowOverlay = e.shouldShow;
      this.syncWindowVisibility();
    });

    this.window = new BrowserWindow({
      icon: path.join(__dirname, process.env.STATIC!, "icon.png"),
      ...OVERLAY_WINDOW_OPTS,
      width: 800,
      height: 600,
      webPreferences: {
        allowRunningInsecureContent: false,
        webviewTag: true,
        spellcheck: false,
      },
    });
    // Atziri Exchange: the overlay is left out of screen captures, so the
    // Death Recap videos (NVIDIA Instant Replay) show only the game. Side
    // effect: it is also hidden in OBS, Discord screen sharing and Windows
    // screenshots.
    this.window.setContentProtection(true);

    this.window.setMenu(
      Menu.buildFromTemplate([
        { role: "editMenu" },
        { role: "reload" },
        { role: "toggleDevTools" },
      ]),
    );

    this.window.webContents.on("before-input-event", this.handleExtraCommands);
    // Atziri Exchange: web tabs are plain web pages, never given app powers
    this.window.webContents.on(
      "will-attach-webview",
      (event, webPreferences, params) => {
        delete webPreferences.preload;
        webPreferences.nodeIntegration = false;
        webPreferences.nodeIntegrationInSubFrames = false;
        webPreferences.contextIsolation = true;
        webPreferences.sandbox = true;
        if (params.src && !isWebUrl(params.src)) event.preventDefault();
      },
    );
    this.window.webContents.on(
      "did-attach-webview",
      (_, webviewWebContents) => {
        webviewWebContents.on("before-input-event", this.handleExtraCommands);
        // links opening a new window stay in the same tab
        webviewWebContents.setWindowOpenHandler((details) => {
          if (isWebUrl(details.url)) webviewWebContents.loadURL(details.url);
          return { action: "deny" };
        });
        // only http(s) pages, no file:// or custom protocols
        webviewWebContents.on("will-navigate", (e, url) => {
          if (!isWebUrl(url)) e.preventDefault();
        });
      },
    );

    this.window.webContents.setWindowOpenHandler((details) => {
      if (isWebUrl(details.url)) shell.openExternal(details.url);
      return { action: "deny" };
    });
  }

  loadAppPage(port: number) {
    const url =
      process.env.VITE_DEV_SERVER_URL || `http://localhost:${port}/index.html`;

    if (!this.window) {
      shell.openExternal(url);
      return;
    }

    if (process.env.VITE_DEV_SERVER_URL) {
      this.window.loadURL(url);
      this.window.webContents.openDevTools({ mode: "detach", activate: false });
    } else {
      this.window.loadURL(url);
    }
  }

  assertOverlayActive = () => {
    if (!this.isInteractable) {
      this.isInteractable = true;

      this.onOverlayActive();

      OverlayController.activateOverlay();
      this.poeWindow.isActive = false;
    }
  };

  assertGameActive = () => {
    if (this.isInteractable) {
      this.isInteractable = false;
      OverlayController.focusTarget();
      this.poeWindow.isActive = true;

      this.onGameActive();
    }
  };

  toggleActiveState = () => {
    this.isOverlayKeyUsed = true;
    if (this.isInteractable) {
      this.assertGameActive();
    } else {
      this.assertOverlayActive();
    }
  };

  updateOpts(
    overlayKey: string,
    windowTitle: string,
    hideOverlayOnBlur: boolean,
  ) {
    this.overlayKey = overlayKey;
    this.poeWindow.attach(this.window, windowTitle);
    this.hideOverlayOnBlur = hideOverlayOnBlur;
  }

  private handleExtraCommands = (
    event: Electron.Event,
    input: Electron.Input,
  ) => {
    if (input.type !== "keyDown") return;

    let { code, control: ctrlKey, shift: shiftKey, alt: altKey } = input;

    if (code.startsWith("Key")) {
      code = code.slice("Key".length);
    } else if (code.startsWith("Digit")) {
      code = code.slice("Digit".length);
    }

    if (shiftKey && altKey) code = `Shift + Alt + ${code}`;
    else if (ctrlKey && shiftKey) code = `Ctrl + Shift + ${code}`;
    else if (ctrlKey && altKey) code = `Ctrl + Alt + ${code}`;
    else if (altKey) code = `Alt + ${code}`;
    else if (ctrlKey) code = `Ctrl + ${code}`;
    else if (shiftKey) code = `Shift + ${code}`;

    switch (code) {
      case "Escape":
      case "Ctrl + W": {
        event.preventDefault();
        process.nextTick(this.assertGameActive);
        break;
      }
      case this.overlayKey: {
        event.preventDefault();
        process.nextTick(this.toggleActiveState);
        break;
      }
    }
  };

  private handleOverlayAttached = (hasAccess?: boolean) => {
    if (hasAccess === false) {
      this.logger.write(
        "error [Overlay] PoE2 is running with administrator rights",
      );

      dialog.showErrorBox(
        "PoE2 window - No access",
        // ----------------------
        "Path of Exile 2 is running with administrator rights.\n" +
          "\n" +
          "You need to restart Atziri Exchange with administrator rights.",
      );
    } else {
      this.server.sendEventTo("broadcast", {
        name: "MAIN->OVERLAY::overlay-attached",
        payload: undefined,
      });
    }
    this.syncWindowVisibility();
  };

  private handlePoeWindowActiveChange = (isActive: boolean) => {
    if (isActive && this.isInteractable) {
      this.isInteractable = false;
    }
    this.server.sendEventTo("broadcast", {
      name: "MAIN->OVERLAY::focus-change",
      payload: {
        game: isActive,
        overlay: this.isInteractable,
        usingHotkey: this.isOverlayKeyUsed,
      },
    });
    this.isOverlayKeyUsed = false;
    this.syncWindowVisibility();
  };

  private syncWindowVisibility() {
    if (!this.window || !this.hideOverlayOnBlur) return;

    if (
      this.isInteractable ||
      (this.shouldShowOverlay && this.poeWindow.isActive)
    ) {
      this.showOverlay();
    } else if (this.window.isVisible()) {
      this.window.hide();
    }
  }

  private showOverlay() {
    if (!this.window || this.window.isVisible() || !this.hideOverlayOnBlur)
      return;

    this.window.showInactive();
    this.window.setAlwaysOnTop(true, "screen-saver");
  }

  private onGameActive() {
    this.syncWindowVisibility();
  }

  private onOverlayActive() {
    this.showOverlay();
  }
}

/** Atziri Exchange: http(s) pages only */
function isWebUrl(url: string) {
  return /^https?:\/\//i.test(url);
}
