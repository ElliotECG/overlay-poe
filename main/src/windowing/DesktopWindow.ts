// My Ritualist Overlay: the hub (prices, trade, Death Recap, settings) in a
// normal window, usable without the game: title bar, taskbar, minimize.
// The page is the same app page with "?desktop=1": the renderer then shows
// only the hub (renderer/src/web/DesktopWindow.vue), and the main process
// never sends it the items copied in game (see server.ts).
import path from "path";
import { app, BrowserWindow, Menu } from "electron";
import { protectWebviews } from "./OverlayWindow";

export class DesktopWindow {
  private window?: BrowserWindow;
  private port = 0;
  private closedListeners: Array<() => void> = [];

  get isOpen() {
    return this.window != null && !this.window.isDestroyed();
  }

  /** The app's page can be loaded (the local server has started) */
  setPort(port: number) {
    this.port = port;
  }

  /** Called when the user closes the window */
  onClosed(cb: () => void) {
    this.closedListeners.push(cb);
  }

  open() {
    if (!this.port && !process.env.VITE_DEV_SERVER_URL) return;
    if (this.isOpen) {
      const win = this.window!;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      return;
    }

    const win = new BrowserWindow({
      title: app.getName(),
      icon: path.join(__dirname, process.env.STATIC!, "icon.png"),
      width: 1360,
      height: 860,
      minWidth: 960,
      minHeight: 640,
      backgroundColor: "#0d0b12",
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        allowRunningInsecureContent: false,
        webviewTag: true,
        spellcheck: false,
      },
    });
    this.window = win;
    win.setMenu(
      Menu.buildFromTemplate([
        { role: "editMenu" },
        { role: "reload" },
        { role: "toggleDevTools" },
      ]),
    );
    win.setMenuBarVisibility(false);
    protectWebviews(win.webContents);
    // keeps the app's name, not the page's title
    win.on("page-title-updated", (e) => { e.preventDefault(); });
    win.once("ready-to-show", () => { win.show(); });
    win.on("closed", () => {
      this.window = undefined;
      for (const cb of this.closedListeners) cb();
    });

    const base =
      process.env.VITE_DEV_SERVER_URL ?? `http://localhost:${this.port}/index.html`;
    win.loadURL(`${base}?desktop=1`);
  }
}
