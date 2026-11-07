import { WebSocketServer, type WebSocket } from "ws";
import { type AddressInfo } from "net";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import type { Duplex } from "stream";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { IpcEvent, IpcEventPayload, HostState } from "../../ipc/types";
import { ConfigStore } from "./host-files/ConfigStore";
import { addFileUploadRoutes } from "./host-files/file-uploads";
import type { AppUpdater } from "./AppUpdater";
import type { Logger } from "./RemoteLogger";

export const server = createServer();
const websocketServer = new WebSocketServer({ noServer: true });

// --- Atziri Exchange: only the app itself may talk to its local server ---
// The server listens on a fixed local port, so any web page (in a normal
// browser or in a web tab of the overlay) could otherwise send it requests:
// proxy calls with the app's cookies, settings changes, keyboard actions in
// the game through the event socket... Requests are accepted only when they
// target this server by its local name (no DNS rebinding) and, when the
// browser says where they come from, only from the app's own page.
let serverPort = 0;

function isLocalHost(hostHeader: string | undefined) {
  if (!hostHeader) return false;
  const host = hostHeader.replace(/:\d+$/, "");
  const port = Number(/:(\d+)$/.exec(hostHeader)?.[1] ?? 80);
  return (
    (host === "localhost" || host === "127.0.0.1" || host === "[::1]") &&
    (serverPort === 0 || port === serverPort)
  );
}

// set when "--listen" exposes the server on the network on purpose
let networkMode = false;

function isTrustedRequest(req: IncomingMessage) {
  if (process.env.VITE_DEV_SERVER_URL) return true; // dev server on another port
  const origin = req.headers.origin;
  if (networkMode) {
    // only the page served by this server itself
    if (origin == null) return true;
    try {
      return new URL(origin).host === req.headers.host;
    } catch {
      return false;
    }
  }
  if (!isLocalHost(req.headers.host)) return false;
  if (origin == null) return true; // same-origin GET, or not from a browser
  try {
    return isLocalHost(new URL(origin).host);
  } catch {
    return false; // "null" origin: sandboxed frame, file://...
  }
}

const emitServerEvent = server.emit.bind(server);
server.emit = ((event: string, ...args: unknown[]) => {
  if (event === "request" && !isTrustedRequest(args[0] as IncomingMessage)) {
    const res = args[1] as ServerResponse;
    res.statusCode = 403;
    res.end();
    return true;
  }
  if (event === "upgrade" && !isTrustedRequest(args[0] as IncomingMessage)) {
    (args[1] as Duplex).destroy();
    return true;
  }
  return emitServerEvent(event, ...args);
}) as typeof server.emit;
let lastActiveClient: WebSocket;

addFileUploadRoutes(server);

if (!process.env.VITE_DEV_SERVER_URL) {
  server.addListener("request", (req, res) => {
    if (
      req.url?.startsWith("/config") ||
      req.url?.startsWith("/uploads") ||
      req.url?.startsWith("/proxy") ||
      req.url?.startsWith("/atziri-data") ||
      // Atziri Exchange: updated item/mod lists already served
      (req as typeof req & { atziriHandled?: boolean }).atziriHandled
    )
      return;

    const filePath = req.url === "/" ? "/index.html" : req.url!;
    switch (path.extname(filePath)) {
      case ".html":
        res.setHeader("content-type", "text/html");
        break;
      case ".js":
        res.setHeader("content-type", "text/javascript");
        break;
      case ".json":
        res.setHeader("content-type", "application/json");
        break;
      case ".svg":
        res.setHeader("content-type", "image/svg+xml");
        break;
    }

    fs.createReadStream(path.join(__dirname, filePath)).pipe(res);
  });
}

const evBus = new EventEmitter();

export function onEventAnyClient<Name extends IpcEvent["name"]>(
  name: Name,
  cb: (payload: IpcEventPayload<Name>) => void,
) {
  evBus.on(name, cb);
}

export function sendEventTo(
  target: "last-active" | "any" | "broadcast",
  event: IpcEvent,
) {
  const msg = JSON.stringify(event);
  if (target === "broadcast") {
    for (const client of websocketServer.clients) {
      client.send(msg);
    }
  } else {
    lastActiveClient.send(msg);
  }
}

export interface ServerEvents {
  onEventAnyClient: typeof onEventAnyClient;
  sendEventTo: typeof sendEventTo;
}
export const eventPipe = {
  onEventAnyClient,
  sendEventTo,
};

server.on("upgrade", (req, socket, head) => {
  if (req.url !== "/events") {
    return req.destroy();
  }
  websocketServer.handleUpgrade(req, socket, head, (ws) => {
    websocketServer.emit("connection", ws, req);
  });
});

export async function startServer(
  appUpdater: AppUpdater,
  logger: Logger,
): Promise<number> {
  const configStore = new ConfigStore(eventPipe);

  websocketServer.on("connection", (socket) => {
    lastActiveClient = socket;
    socket.on("message", (bytes) => {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      const event = JSON.parse(bytes.toString("utf-8")) as IpcEvent;
      if (event.name === "CLIENT->MAIN::used-recently") {
        lastActiveClient = socket;
      }
      evBus.emit(event.name, event.payload);
    });
    socket.on("close", () => {
      const clients = websocketServer.clients;
      if (clients.size === 1) {
        lastActiveClient = clients.values().next().value!;
        evBus.emit("CLIENT->MAIN::used-recently", { isOverlay: true });
      }
    });
    sendEventTo("last-active", {
      name: "MAIN->CLIENT::log-entry",
      payload: { message: logger.history },
    });
  });

  server.addListener("request", async (req, res) => {
    if (req.url === "/config") {
      res.setHeader("content-type", "application/json");
      const resBody: HostState = {
        version: app.getVersion(),
        updater: appUpdater.info,
        contents: await configStore.load(),
      };
      res.end(JSON.stringify(resBody));
    }
  });

  // Atziri Exchange: fixed port so the page keeps the same origin between
  // launches (its saved data — colors, favorites, history... — lives there)
  let port = process.env.VITE_DEV_SERVER_URL ? 8584 : ATZIRI_PORT;
  let host = "127.0.0.1";
  // --listen=[host][:port]
  const listenOpt = process.argv.find((arg) => arg.startsWith("--listen"));
  if (listenOpt) {
    const [hostArg, portArg] = listenOpt.split("=")[1].split(":");
    if (hostArg) host = hostArg;
    if (portArg) port = parseInt(portArg, 10);
  }
  networkMode = !["127.0.0.1", "localhost", "::1"].includes(host);

  const listen = async (p: number) =>
    await new Promise<number>((resolve, reject) => {
      server.once("error", reject);
      server.listen({ port: p, host }, () => {
        server.off("error", reject);
        serverPort = (server.address() as AddressInfo).port;
        resolve(serverPort);
      });
    });

  try {
    return await listen(port);
  } catch (e) {
    // fixed port busy: fall back to any free port
    if (port === ATZIRI_PORT && (e as NodeJS.ErrnoException).code === "EADDRINUSE") {
      logger.write(`warn [Server] Port ${ATZIRI_PORT} busy, using a random port.`);
      return await listen(0);
    }
    throw e;
  }
}

const ATZIRI_PORT = 41917;
