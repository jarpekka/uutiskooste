const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const { AREAS, SOURCES } = require("./lib/sources");
const { buildDigest, checkSourceHealth, cleanError, parseOptions } = require("./lib/digest");

const PORT = Number(process.env.PORT || 4174);
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = path.join(__dirname, "public");

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}

function serveStatic(req, res) {
  const reqPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  const filePath = reqPath === "/" ? path.join(PUBLIC_DIR, "index.html") : path.join(PUBLIC_DIR, reqPath);
  const normalized = path.normalize(filePath);

  if (!normalized.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(normalized, (error, data) => {
    if (error) {
      sendText(res, 404, "Not found");
      return;
    }

    const ext = path.extname(normalized);
    const mime =
      ext === ".html"
        ? "text/html; charset=utf-8"
        : ext === ".css"
          ? "text/css; charset=utf-8"
          : ext === ".js"
            ? "text/javascript; charset=utf-8"
            : "application/octet-stream";
    res.writeHead(200, { "content-type": mime, "cache-control": "no-store" });
    res.end(data);
  });
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

async function handleApi(req, res) {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

  if (pathname === "/api/sources") {
    sendJson(res, 200, { areas: AREAS, sources: SOURCES });
    return;
  }

  if (pathname === "/api/digest") {
    try {
      const options = parseOptions(req.url);
      const body = req.method === "POST" ? await readJsonBody(req) : {};
      const digest = await buildDigest(options, body.customSources || []);
      sendJson(res, 200, digest);
    } catch (error) {
      sendJson(res, 500, {
        error: "Koosteen laatiminen epaonnistui.",
        detail: cleanError(error.message)
      });
    }
    return;
  }

  if (pathname === "/api/source-health") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    try {
      const options = parseOptions(req.url);
      const body = await readJsonBody(req);
      const report = await checkSourceHealth(options, body.customSources || []);
      sendJson(res, 200, report);
    } catch (error) {
      sendJson(res, 500, {
        error: "Lähteiden tarkistus epäonnistui.",
        detail: cleanError(error.message)
      });
    }
    return;
  }

  sendJson(res, 404, { error: "Tuntematon API-polku." });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res);
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Uutiskooste Vercel local: http://${HOST}:${PORT}`);
});
