const { AREAS, SOURCES } = require("../lib/sources");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.setHeader("cache-control", "no-store");
  res.status(200).json({ areas: AREAS, sources: SOURCES });
};
