import { createReadStream, promises as fs } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_SNAPSHOT } from "./demo-data.mjs";
import { scanContext } from "./scanner.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const runtimeDirectory = path.join(projectRoot, "runtime");
const cachePath = path.join(runtimeDirectory, "context-index.json");
const isDev = process.argv.includes("--dev");
const host = "127.0.0.1";
const port = Number(process.env.PORT || 4311);
const demoOnly = process.env.LUMEN_MODE === "demo";
const configuredRoots = process.env.LUMEN_SCAN_ROOTS
  ? process.env.LUMEN_SCAN_ROOTS.split(path.delimiter).filter(Boolean)
  : [
      path.join(os.homedir(), "Documents", "Obsidian Vault"),
      path.join(os.homedir(), "Documents", "完项目"),
      path.join(os.homedir(), "Documents"),
      path.join(os.homedir(), ".codex", "memories"),
      path.join(os.homedir(), ".openclaw", "workspace"),
      os.homedir()
    ];

let latestSnapshot = {
  version: 1,
  status: "idle",
  scannedAt: null,
  roots: configuredRoots,
  stats: { directoriesScanned: 0, candidateFiles: 0, ignoredFiles: 0, visibleSignals: 0, hiddenSignals: 0, truncated: false },
  visibleSignals: []
};
let activeScan = null;

async function loadCache() {
  try {
    latestSnapshot = JSON.parse(await fs.readFile(cachePath, "utf8"));
  } catch {
    // The first run intentionally starts without an index.
  }
}

async function saveCache(snapshot) {
  await fs.mkdir(runtimeDirectory, { recursive: true });
  await fs.writeFile(cachePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

async function refreshContext() {
  if (activeScan) return activeScan;
  latestSnapshot = { ...latestSnapshot, status: "scanning" };
  activeScan = scanContext({ roots: configuredRoots })
    .then(async (snapshot) => {
      latestSnapshot = snapshot;
      await saveCache(snapshot);
      return snapshot;
    })
    .catch((error) => {
      latestSnapshot = { ...latestSnapshot, status: "error", error: String(error?.message || error) };
      return latestSnapshot;
    })
    .finally(() => {
      activeScan = null;
    });
  return activeScan;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

async function handleApi(request, response, url) {
  const { pathname } = url;
  const useDemo = demoOnly || url.searchParams.get("demo") === "1";
  if (pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, { ok: true, product: "LUMEN", service: "local-context", mode: useDemo ? "demo" : "local", status: useDemo ? "ready" : latestSnapshot.status });
    return true;
  }
  if (pathname === "/api/context" && request.method === "GET") {
    if (useDemo) {
      sendJson(response, 200, DEMO_SNAPSHOT);
      return true;
    }
    if (latestSnapshot.status === "idle") void refreshContext();
    sendJson(response, 200, latestSnapshot);
    return true;
  }
  if (pathname === "/api/context/scan" && request.method === "POST") {
    if (useDemo) {
      sendJson(response, 200, DEMO_SNAPSHOT);
      return true;
    }
    sendJson(response, 200, await refreshContext());
    return true;
  }
  return false;
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp"
};

async function serveProduction(request, response, pathname) {
  const distRoot = path.join(projectRoot, "dist");
  const requested = pathname === "/" ? "/index.html" : pathname;
  let filePath = path.resolve(distRoot, `.${requested}`);
  if (!filePath.startsWith(distRoot)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error("not a file");
  } catch {
    filePath = path.join(distRoot, "index.html");
  }
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
    "Cache-Control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable"
  });
  createReadStream(filePath).pipe(response);
}

if (demoOnly) latestSnapshot = DEMO_SNAPSHOT;
else await loadCache();
let vite = null;
if (isDev) {
  const { createServer: createViteServer } = await import("vite");
  vite = await createViteServer({ root: projectRoot, appType: "spa", server: { middlewareMode: true } });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `${host}:${port}`}`);
  if (await handleApi(request, response, url)) return;
  if (vite) {
    vite.middlewares(request, response, () => sendJson(response, 404, { error: "Not found" }));
    return;
  }
  await serveProduction(request, response, url.pathname);
});

server.listen(port, host, () => {
  console.log(`LUMEN ${demoOnly ? "demo" : isDev ? "dev" : "local"} server: http://${host}:${port}`);
  if (!demoOnly) void refreshContext();
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await vite?.close();
    server.close(() => process.exit(0));
  });
}
