// My Ritualist Overlay: this page is the desktop window (a normal window
// with the hub, usable without the game), not the overlay over the game.
// See main/src/windowing/DesktopWindow.ts.
export const isDesktopWindow =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("desktop") === "1";
