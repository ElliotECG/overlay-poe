// My Ritualist Overlay: puts the Ritualist icon and the app's name on
// "My Ritualist Overlay.exe". electron-builder normally does it, but that step
// is turned off here (signAndEditExecutable: false, no symbolic-link rights on
// this PC), so the exe kept Electron's icon and was called "Electron" in the
// Task Manager. This runs rcedit: from the "rcedit" package (devDependency),
// else from electron-builder's cache.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function findRcedit() {
  const fromPackage = path.join(__dirname, "..", "node_modules", "rcedit", "bin", "rcedit-x64.exe");
  if (fs.existsSync(fromPackage)) return fromPackage;
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
  const appInfo = context.packager.appInfo;
  const exe = path.join(context.appOutDir, `${appInfo.productFilename}.exe`);
  const icon = path.join(__dirname, "icons", "icon.ico");
  const rcedit = findRcedit();
  if (!rcedit) {
    throw new Error(
      "rcedit-x64.exe not found (npm install in main/): cannot set the exe icon",
    );
  }
  execFileSync(rcedit, [
    exe,
    "--set-icon", icon,
    "--set-version-string", "ProductName", appInfo.productName,
    "--set-version-string", "FileDescription", appInfo.productName,
    "--set-version-string", "CompanyName", "ElliotECG",
    "--set-version-string", "OriginalFilename", path.basename(exe),
    "--set-file-version", appInfo.shortVersion || appInfo.version,
    "--set-product-version", appInfo.version,
  ]);
  console.log(`  • Ritualist icon and name set on ${path.basename(exe)}`);
};
