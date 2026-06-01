const { checkSourceHealth, cleanError, parseOptions } = require("../lib/digest");

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
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.setHeader("cache-control", "no-store");

  try {
    const options = parseOptions(req.url);
    const body = await readJsonBody(req);
    const report = await checkSourceHealth(options, body.customSources || []);
    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({
      error: "Lähteiden tarkistus epäonnistui.",
      detail: cleanError(error.message)
    });
  }
};
