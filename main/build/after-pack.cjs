// Atziri Exchange: puts the Atziri icon on "Atziri Exchange.exe".
// electron-builder normally does it, but that step is turned off here
// (signAndEditExecutable: false, no symbolic-link rights on this PC), so the
// exe kept Electron's icon. This runs rcedit from electron-builder's cache.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function findRcedit() {
  const cache = path.join(
    process.env.LOCALAPPDATA || "",
    "electron-builder",
    "Cache",
    "winCodeSign",
  );
  if (!fs.existsSync(cache)) return undefined;
  for (const dir of fs.readdirSync(cache)) {
    const exe = path.join(cache, dir, "rcedit-x64.exe");
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  const exe = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.exe`,
  );
  const icon = path.join(__dirname, "icons", "icon.ico");
  const rcedit = findRcedit();
  if (!rcedit) {
    throw new Error(
      "rcedit-x64.exe not found in the electron-builder cache: cannot set the exe icon",
    );
  }
  execFileSync(rcedit, [exe, "--set-icon", icon]);
  console.log(`  • Atziri icon set on ${path.basename(exe)}`);
};
