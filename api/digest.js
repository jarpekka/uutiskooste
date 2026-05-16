const { buildDigest, cleanError, parseOptions } = require("../lib/digest");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.setHeader("cache-control", "no-store");

  try {
    const options = parseOptions(req.url);
    const digest = await buildDigest(options);
    res.status(200).json(digest);
  } catch (error) {
    res.status(500).json({
      error: "Koosteen laatiminen epaonnistui.",
      detail: cleanError(error.message)
    });
  }
};
