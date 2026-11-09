import path from "path";
import { app, Tray, Menu, shell, nativeImage, dialog } from "electron";
import type { ServerEvents } from "./server";

export class AppTray {
  public overlayKey = "Shift + Space";
  private tray: Tray;
  serverPort = 0;
  /** My Ritualist Overlay: opens the desktop window (set in main.ts) */
  onOpen?: () => void;

  constructor(server: ServerEvents) {
    let trayImage = nativeImage.createFromPath(
      path.join(
        __dirname,
        process.env.STATIC!,
        process.platform === "win32" ? "icon.ico" : "icon.png",
      ),
    );

    if (process.platform === "darwin") {
      // Mac image size needs to be smaller, or else it looks huge. Size
      // guideline is from https://iconhandbook.co.uk/reference/chart/osx/
      trayImage = trayImage.resize({ width: 22, height: 22 });
    }

    this.tray = new Tray(trayImage);
    this.tray.setToolTip(`My Ritualist Overlay v${app.getVersion()}`);
    this.rebuildMenu();
    // My Ritualist Overlay: a click on the icon opens the desktop window
    this.tray.on("click", () => this.onOpen?.());

    server.onEventAnyClient("CLIENT->MAIN::user-action", ({ action }) => {
      if (action === "quit") {
        app.quit();
      }
    });
  }

  rebuildMenu() {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Ouvrir la fenêtre",
        click: () => this.onOpen?.(),
      },
      { type: "separator" },
      {
        label: "Settings/League",
        click: () => {
          dialog.showMessageBox({
            title: "Settings",
            message: `Open Path of Exile 2 and press "${this.overlayKey}". Click on the button with cog icon there.`,
          });
        },
      },
      {
        label: "Open in Browser",
        click: () => {
          shell.openExternal(`http://localhost:${this.serverPort}`);
        },
      },
      { type: "separator" },
      {
        label: "Open config folder",
        click: () => {
          shell.openPath(path.join(app.getPath("userData"), "apt-data"));
        },
      },
      {
        label: "Quit",
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }
}
