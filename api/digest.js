const { buildDigest, cleanError, parseOptions } = require("../lib/digest");

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

module.exports = async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.setHeader("cache-control", "no-store");

  try {
    const options = parseOptions(req.url);
    const body = req.method === "POST" ? await readJsonBody(req) : {};
    const digest = await buildDigest(options, body.customSources || [], body.preferences || {});
    res.status(200).json(digest);
  } catch (error) {
    res.status(500).json({
      error: "Koosteen laatiminen epaonnistui.",
      detail: cleanError(error.message)
    });
  }
};
