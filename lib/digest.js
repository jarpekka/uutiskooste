const { URL } = require("node:url");
const { AREAS, SOURCES } = require("./sources");

const CACHE_TTL_MS = 4 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 9000;
const USER_AGENT =
  "UutiskoosteMVP/1.0 (+local personal news digest; uses only configured source domains)";

let cachedDigest = null;

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtml(value = "") {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstTag(block, tagNames) {
  for (const tag of tagNames) {
    const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
    if (match) return stripHtml(match[1]);
  }
  return "";
}

function firstLink(block, baseUrl) {
  const href = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  const textLink = block.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i);
  const guidLink = block.match(/<guid(?:\s[^>]*)?>(https?:\/\/[\s\S]*?)<\/guid>/i);
  const raw = href?.[1] || textLink?.[1] || guidLink?.[1] || "";
  return normalizeUrl(decodeEntities(raw.trim()), baseUrl);
}

function parseDate(value) {
  if (!value) return null;
  const time = Date.parse(stripHtml(value));
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function parseFeed(xml, source, sourceUrl) {
  const blocks = [
    ...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)
  ].map((match) => match[0]);

  return blocks.map((block) => ({
    title: firstTag(block, ["title"]),
    link: firstLink(block, sourceUrl),
    description: firstTag(block, ["description", "summary", "content:encoded", "content"]),
    publishedAt: parseDate(firstTag(block, ["pubDate", "published", "updated", "dc:date"])),
    source: source.name,
    areaCandidates: source.areas,
    sourceSite: source.site,
    primaryNewsSource: source.primaryNewsSource,
    from: "feed"
  }));
}

function normalizeUrl(value, baseUrl) {
  if (!value) return "";
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

function allowedHost(source, itemUrl) {
  try {
    const sourceHost = new URL(source.site).hostname.replace(/^www\./, "");
    const itemHost = new URL(itemUrl).hostname.replace(/^www\./, "");
    return itemHost === sourceHost || itemHost.endsWith(`.${sourceHost}`);
  } catch {
    return false;
  }
}

function parseListingPage(html, source, pageUrl) {
  const found = [];
  const anchors = html.matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi);

  for (const match of anchors) {
    const attrs = match[1];
    const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
    const title = stripHtml(match[2]);
    const link = normalizeUrl(decodeEntities(href || ""), pageUrl);

    if (!link || !title || title.length < 18 || !allowedHost(source, link)) continue;
    if (found.some((item) => item.link === link)) continue;

    found.push({
      title,
      link,
      description: "",
      publishedAt: null,
      source: source.name,
      areaCandidates: source.areas,
      sourceSite: source.site,
      primaryNewsSource: source.primaryNewsSource,
      from: "page"
    });
  }

  return found.slice(0, 25);
}

async function fetchSource(source) {
  const results = [];
  const warnings = [];
  const feedUrls = source.feedUrls || [];
  const pageUrls = source.pageUrls || [];

  for (const feedUrl of feedUrls) {
    try {
      const xml = await fetchWithTimeout(feedUrl);
      const items = parseFeed(xml, source, feedUrl);
      results.push(...items);
    } catch (error) {
      warnings.push(`${source.name}: syotteen haku epaonnistui (${cleanError(error.message)}).`);
    }
  }

  if (results.length === 0) {
    for (const pageUrl of pageUrls) {
      try {
        const html = await fetchWithTimeout(pageUrl);
        const items = parseListingPage(html, source, pageUrl);
        results.push(...items);
      } catch (error) {
        warnings.push(`${source.name}: sivun haku epaonnistui (${cleanError(error.message)}).`);
      }
    }
  }

  if (feedUrls.length === 0 && pageUrls.length === 0) {
    warnings.push(`${source.name}: lahteelle ei ole maaritetty luettavaa syotetta.`);
  }

  return { source: source.name, results, warnings };
}

function cleanError(message = "") {
  return String(message).replace(/\s+/g, " ").slice(0, 90);
}

function normalizeForMatch(value = "") {
  return stripHtml(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9åäö]+/g, " ")
    .replace(/\b(the|a|an|and|or|to|of|in|on|for|with|from|says|after|as|at|is|are|will|that|this|nyt|kuva|katso|tassa|täällä|uutiset|breaking)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value) {
  return new Set(normalizeForMatch(value).split(" ").filter((token) => token.length > 2));
}

function termMatches(haystack, term) {
  const normalizedTerm = normalizeForMatch(term);
  if (!normalizedTerm) return false;
  if (normalizedTerm.includes(" ")) return haystack.includes(normalizedTerm);
  return new Set(haystack.split(" ")).has(normalizedTerm);
}

function similarity(a, b) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }
  return shared / Math.min(left.size, right.size);
}

function hasExcludedContent(item, source) {
  const haystack = normalizeForMatch(`${item.title} ${item.link} ${item.description}`);
  return (source.exclude || []).some((term) => termMatches(haystack, term));
}

function matchesTopic(item, source) {
  if (source.requiredKeywordGroups && source.requiredKeywordGroups.length > 0) {
    const haystack = normalizeForMatch(`${item.title} ${item.description} ${item.link}`);
    return source.requiredKeywordGroups.every((group) =>
      group.some((term) => termMatches(haystack, term))
    );
  }

  if (!source.topicKeywords || source.topicKeywords.length === 0) return true;
  const haystack = normalizeForMatch(`${item.title} ${item.description} ${item.link}`);
  return source.topicKeywords.some((term) => termMatches(haystack, term));
}

function keywordScore(item, terms, weight) {
  if (!terms || terms.length === 0) return 0;
  const haystack = normalizeForMatch(`${item.title} ${item.description} ${item.link}`);
  return terms.reduce((score, term) => score + (termMatches(haystack, term) ? weight : 0), 0);
}

function itemPriorityScore(item, source) {
  if (!source) return 0;
  return keywordScore(item, source.boostKeywords, 100) - keywordScore(item, source.deprioritizeKeywords, 25);
}

function isAcceptable(item, source, options) {
  if (!item.title || item.title.length < 12) return false;
  if (!item.link || !allowedHost(source, item.link)) return false;
  if (!source.allowedLanguages.includes(options.language) && options.language !== "fi") return false;
  if (hasExcludedContent(item, source)) return false;
  if (!matchesTopic(item, source)) return false;
  if (item.publishedAt && options.hours > 0) {
    const minTime = Date.now() - options.hours * 60 * 60 * 1000;
    if (Date.parse(item.publishedAt) < minTime) return false;
  }
  return true;
}

function preferItem(a, b) {
  const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
  const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
  if (a.primaryNewsSource !== b.primaryNewsSource) return a.primaryNewsSource ? a : b;
  if (aTime !== bTime) return aTime > bTime ? a : b;
  return a.description.length >= b.description.length ? a : b;
}

function dedupe(items) {
  const selected = [];
  const duplicateNotes = [];

  for (const item of items) {
    const matchIndex = selected.findIndex((existing) => {
      if (existing.link === item.link) return true;
      return similarity(existing.title, item.title) >= 0.68;
    });

    if (matchIndex === -1) {
      selected.push({ ...item, alsoCoveredBy: [] });
      continue;
    }

    const current = selected[matchIndex];
    const preferred = preferItem(current, item);
    const other = preferred === current ? item : current;
    preferred.alsoCoveredBy = Array.from(new Set([...(preferred.alsoCoveredBy || []), other.source]));
    selected[matchIndex] = preferred;
    duplicateNotes.push(`Samankaltainen aihe yhdistettiin: ${preferred.source} / ${other.source}.`);
  }

  return { items: selected, duplicateNotes };
}

function summarySentences(value, maxSentences, maxLength) {
  const sentences = stripHtml(value || "")
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\bContinue reading\b[\s\S]*$/i, " ")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 30 && sentence.length < 260);

  const selected = [];
  let length = 0;
  for (const sentence of sentences) {
    const nextLength = length + sentence.length + (selected.length ? 1 : 0);
    if (selected.length > 0 && nextLength > maxLength) break;
    selected.push(sentence);
    length = nextLength;
    if (selected.length >= maxSentences) break;
  }

  return selected.join(" ");
}

function summarize(item, mode, language) {
  const text = stripHtml(item.description || "");
  const maxSentences = mode === "wide" ? 3 : 2;
  const maxLength = mode === "wide" ? 520 : 360;
  const summaryText = summarySentences(text, maxSentences, maxLength);

  if (language === "en") {
    return summaryText || `Latest report: ${item.title}.`;
  }

  if (mode === "wide") {
    const first = summaryText ? `Uutisen ydin: ${summaryText}` : `Uutinen kasittelee aihetta "${item.title}".`;
    const context = item.alsoCoveredBy?.length
      ? `Samaa aihetta kasittelevat myos ${item.alsoCoveredBy.join(", ")}.`
      : "Kooste perustuu lahteen julkaisemaan otsikkoon ja syotetekstiin.";
    return `${first} ${context}`;
  }

  if (summaryText) {
    return `Ydin: ${summaryText.replace(/\.$/, "")}.`;
  }

  return `Ydin: ${item.title}.`;
}

function formatDate(iso, language) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "fi-FI", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Helsinki"
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

function buildMarkdown(sections, options, generatedAt) {
  const language = options.language;
  const title = language === "en" ? "News Digest" : "Uutiskooste";
  const lines = [`# ${title}`, "", `${language === "en" ? "Generated" : "Laadittu"}: ${formatDate(generatedAt, language)}`, ""];

  for (const section of sections) {
    lines.push(`## ${section.name}`, "");
    if (section.items.length === 0) {
      lines.push(language === "en" ? "No acceptable news found." : "Hyvaksyttavia uutisia ei loytynyt.", "");
      continue;
    }

    section.items.forEach((item, index) => {
      const datePart = options.showTime && item.displayTime ? `, ${item.displayTime}` : "";
      lines.push(`${index + 1}. ${item.title} -- ${item.source}${datePart}`);
      lines.push(item.summary);
      if (options.showLinks) lines.push(`Linkki: ${item.link}`);
      lines.push("");
    });
  }

  return lines.join("\n").trim();
}

function parseOptions(requestUrl) {
  const search = new URL(requestUrl, "http://localhost").searchParams;
  const selectedAreas = search.get("areas")?.split(",").filter(Boolean) || AREAS.map((area) => area.id);
  return {
    areas: selectedAreas.filter((area) => AREAS.some((known) => known.id === area)),
    maxPerArea: Math.min(Math.max(Number(search.get("max") || 5), 1), 5),
    mode: search.get("mode") === "wide" ? "wide" : "compact",
    language: search.get("language") === "en" ? "en" : "fi",
    hours: Math.min(Math.max(Number(search.get("hours") || 24), 1), 24 * 14),
    showLinks: search.get("links") !== "false",
    showTime: search.get("time") !== "false"
  };
}

async function buildDigest(options) {
  const cacheKey = JSON.stringify(options);
  if (cachedDigest && cachedDigest.key === cacheKey && Date.now() - cachedDigest.createdAt < CACHE_TTL_MS) {
    return cachedDigest.payload;
  }

  const activeSources = SOURCES.filter((source) => source.areas.some((area) => options.areas.includes(area)));
  const fetched = await Promise.all(activeSources.map(fetchSource));
  const sourceByName = new Map(SOURCES.map((source) => [source.name, source]));
  const warnings = fetched.flatMap((entry) => entry.warnings);
  const notes = activeSources.filter((source) => source.note).map((source) => `${source.name}: ${source.note}`);

  const sections = AREAS.filter((area) => options.areas.includes(area.id)).map((area) => {
    const areaItems = fetched
      .flatMap((entry) => entry.results)
      .filter((item) => item.areaCandidates.includes(area.id))
      .filter((item) => {
        const source = sourceByName.get(item.source);
        return source && isAcceptable(item, source, options);
      })
      .sort((a, b) => {
        const aScore = itemPriorityScore(a, sourceByName.get(a.source));
        const bScore = itemPriorityScore(b, sourceByName.get(b.source));
        if (aScore !== bScore) return bScore - aScore;
        const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
        const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
        return bTime - aTime;
      });

    const deduped = dedupe(areaItems);
    warnings.push(...deduped.duplicateNotes.slice(0, 6));

    const items = deduped.items.slice(0, options.maxPerArea).map((item) => ({
      ...item,
      summary: summarize(item, options.mode, options.language),
      displayTime: formatDate(item.publishedAt, options.language)
    }));

    if (items.length < options.maxPerArea) {
      warnings.push(`${area.name}-osiosta loytyi vain ${items.length} hyvaksyttavaa uutista maaritetyista lahteista.`);
    }

    return { id: area.id, name: area.name, items };
  });

  const generatedAt = new Date().toISOString();
  const payload = {
    generatedAt,
    options,
    areas: AREAS,
    sourceCount: activeSources.length,
    sections,
    warnings: Array.from(new Set([...warnings, ...notes])).slice(0, 30),
    markdown: buildMarkdown(sections, options, generatedAt)
  };

  cachedDigest = { key: cacheKey, createdAt: Date.now(), payload };
  return payload;
}

module.exports = {
  buildDigest,
  cleanError,
  parseOptions
};
