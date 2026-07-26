const { URL } = require("node:url");
const { AREAS, SOURCES, COMMON_EXCLUSIONS } = require("./sources");

const CACHE_TTL_MS = 4 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 9000;
const ARTICLE_TIMEOUT_MS = 6000;
const MAX_CUSTOM_SOURCES = 24;
const MAX_PREFERENCE_TERMS = 40;
const MAX_FEEDBACK_TITLES = 30;
const MAX_ITEMS_PER_SOURCE = 2;
const MAX_CANDIDATES_PER_AREA = 18;
const MAX_ARTICLE_FETCHES_PER_AREA = 8;
const ARTICLE_FETCH_CONCURRENCY = 8;
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
    .replace(/&nbsp;/g, " ")
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

function allTagValues(block, tagNames) {
  const values = [];
  for (const tag of tagNames) {
    const paired = block.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi"));
    for (const match of paired) {
      const value = stripHtml(match[1]);
      if (value) values.push(value);
    }
    const terms = block.matchAll(new RegExp(`<${tag}\\b[^>]*\\bterm=["']([^"']+)["'][^>]*\\/?>`, "gi"));
    for (const match of terms) {
      const value = stripHtml(match[1]);
      if (value) values.push(value);
    }
  }
  return Array.from(new Set(values));
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

function valueFromObject(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return value.url || value["@id"] || "";
  return "";
}

function jsonLdObjects(html) {
  const objects = [];
  const scripts = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  function collect(value) {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (!value || typeof value !== "object") return;
    objects.push(value);
    if (value["@graph"]) collect(value["@graph"]);
    if (value.itemListElement) collect(value.itemListElement);
    if (value.item && typeof value.item === "object") collect(value.item);
  }

  for (const match of scripts) {
    try {
      collect(JSON.parse(match[1].trim()));
    } catch {
      // Invalid analytics or third-party JSON-LD should not discard the page.
    }
  }
  return objects;
}

function schemaTypes(object) {
  const raw = Array.isArray(object?.["@type"]) ? object["@type"] : [object?.["@type"]];
  return raw.filter(Boolean).map((type) => String(type).toLowerCase());
}

function isArticleSchema(object) {
  return schemaTypes(object).some((type) =>
    ["article", "newsarticle", "reportagenewsarticle"].includes(type)
  );
}

function metaContent(html, keys) {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta\\b[^>]*(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"),
      new RegExp(`<meta\\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${escaped}["'][^>]*>`, "i")
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return stripHtml(match[1]);
    }
  }
  return "";
}

function firstTime(block) {
  const datetime = block.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i)?.[1];
  if (datetime) return parseDate(datetime);
  return parseDate(stripHtml(block.match(/<time\b[^>]*>([\s\S]*?)<\/time>/i)?.[1] || ""));
}

function articleBodyFromHtml(html) {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || "";
  const paragraphs = [...article.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter((text) => text.length >= 45 && !/^(share|follow|read more|advertisement)/i.test(text));
  return paragraphs.join(" ").slice(0, 2400);
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
    articleSection: allTagValues(block, ["category", "dc:subject"]).join(" "),
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

function pathAllowed(source, itemUrl) {
  try {
    const path = new URL(itemUrl).pathname.toLowerCase();
    const included = source.articlePathPatterns || [];
    const excluded = source.excludePathPatterns || [];
    if (included.length > 0 && !included.some((pattern) => path.includes(pattern.toLowerCase()))) return false;
    return !excluded.some((pattern) => path.includes(pattern.toLowerCase()));
  } catch {
    return false;
  }
}

function isLikelyArticleLink(title, link, source) {
  if (!pathAllowed(source, link)) return false;
  const normalizedTitle = normalizeForMatch(title);
  const words = normalizedTitle.split(" ").filter(Boolean);
  if (title.length < 24 || words.length < 4) return false;
  if (/^(skip to|main content|read more|learn more|view all|show all|see all|latest|news|home|menu|search|subscribe|sign in|log in)/i.test(title)) {
    return false;
  }
  try {
    const path = new URL(link).pathname.replace(/\/+$/, "");
    if (!path || path === "/") return false;
    return path.split("/").filter(Boolean).length >= 2 || /\d{4}/.test(path);
  } catch {
    return false;
  }
}

function structuredListingItems(html, source, pageUrl) {
  const found = [];
  for (const object of jsonLdObjects(html)) {
    if (!isArticleSchema(object)) continue;
    const title = stripHtml(object.headline || object.name || "");
    const rawUrl = valueFromObject(object.url) || valueFromObject(object.mainEntityOfPage);
    const link = normalizeUrl(rawUrl, pageUrl);
    if (!title || !link || !allowedHost(source, link) || !pathAllowed(source, link)) continue;
    found.push({
      title,
      link,
      description: stripHtml(object.description || object.articleBody || "").slice(0, 2400),
      publishedAt: parseDate(object.datePublished || object.dateCreated || object.dateModified),
      source: source.name,
      areaCandidates: source.areas,
      sourceSite: source.site,
      primaryNewsSource: source.primaryNewsSource,
      from: "structured-page"
    });
  }
  return found;
}

function parseListingPage(html, source, pageUrl) {
  const found = structuredListingItems(html, source, pageUrl);
  const articleBlocks = html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi);

  for (const match of articleBlocks) {
    const block = match[0];
    const anchor = block.match(/<a\b([^>]*?)>([\s\S]*?)<\/a>/i);
    const href = anchor?.[1]?.match(/\bhref=["']([^"']+)["']/i)?.[1];
    const heading = block.match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i)?.[1];
    const title = stripHtml(heading || anchor?.[2] || "");
    const link = normalizeUrl(decodeEntities(href || ""), pageUrl);
    if (!link || !title || !allowedHost(source, link) || !pathAllowed(source, link)) continue;
    if (found.some((item) => item.link === link)) continue;
    found.push({
      title,
      link,
      description: stripHtml(block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || ""),
      publishedAt: firstTime(block),
      source: source.name,
      areaCandidates: source.areas,
      sourceSite: source.site,
      primaryNewsSource: source.primaryNewsSource,
      from: "article-listing"
    });
  }

  const anchors = html.matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi);

  for (const match of anchors) {
    const attrs = match[1];
    const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
    const title = stripHtml(match[2]);
    const link = normalizeUrl(decodeEntities(href || ""), pageUrl);

    if (!link || !title || !allowedHost(source, link) || !isLikelyArticleLink(title, link, source)) continue;
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
      from: "generic-listing"
    });
  }

  return found.slice(0, 25);
}

function parseArticlePage(html, item) {
  const structured = jsonLdObjects(html).find(isArticleSchema);
  const structuredTitle = stripHtml(structured?.headline || structured?.name || "");
  const title = structuredTitle || metaContent(html, ["og:title", "twitter:title"]) || item.title;
  const structuredBody = stripHtml(structured?.articleBody || structured?.description || "");
  const description =
    structuredBody ||
    articleBodyFromHtml(html) ||
    metaContent(html, ["description", "og:description", "twitter:description"]);
  const publishedAt =
    parseDate(structured?.datePublished || structured?.dateCreated || structured?.dateModified) ||
    parseDate(metaContent(html, ["article:published_time", "datePublished", "date", "date.created"])) ||
    firstTime(html);
  const section = stripHtml(structured?.articleSection || metaContent(html, ["article:section"]));

  return {
    ...item,
    title: title.length >= 12 ? title : item.title,
    description: description.length >= item.description.length ? description.slice(0, 2400) : item.description,
    publishedAt: publishedAt || item.publishedAt,
    articleSection: section,
    from: description || publishedAt ? "article" : item.from
  };
}

function needsArticleFetch(item) {
  return !item.publishedAt || item.description.length < 140 || item.from !== "feed";
}

async function enrichArticle(item, source) {
  if (!needsArticleFetch(item)) return item;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ARTICLE_TIMEOUT_MS);
  try {
    const response = await fetch(item.link, {
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" }
    });
    if (!response.ok) return item;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("html")) return item;
    return parseArticlePage(await response.text(), item);
  } catch {
    return item;
  } finally {
    clearTimeout(timer);
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
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

  if (pageUrls.length > 0) {
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

  const uniqueResults = results.filter(
    (item, index, all) => item.link && all.findIndex((candidate) => candidate.link === item.link) === index
  );
  return { source: source.name, results: uniqueResults, warnings };
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

function splitTerms(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((term) => String(term).trim()).filter(Boolean).slice(0, 40);
  return String(value)
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function httpUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value).trim());
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function siteFromUrl(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return "";
  }
}

function prepareCustomSources(rawSources = []) {
  const warnings = [];
  const validAreaIds = new Set(AREAS.map((area) => area.id));
  const sources = [];

  for (const [index, raw] of (Array.isArray(rawSources) ? rawSources : []).slice(0, MAX_CUSTOM_SOURCES).entries()) {
    const name = String(raw?.name || "").trim().slice(0, 80);
    const feedUrl = httpUrl(raw?.feedUrl || raw?.feedUrls?.[0]);
    const site = httpUrl(raw?.site || raw?.siteUrl) || siteFromUrl(feedUrl);
    const areas = (Array.isArray(raw?.areas) ? raw.areas : [raw?.area])
      .map((area) => String(area || "").trim())
      .filter((area) => validAreaIds.has(area));
    const language = raw?.language === "en" ? "en" : "fi";

    if (!name || !feedUrl || !site || areas.length === 0) {
      warnings.push(`Oma lähde ${index + 1} ohitettiin, koska nimi, alue tai RSS-syöte puuttuu.`);
      continue;
    }

    sources.push({
      name: `Oma: ${name}`,
      areas,
      site,
      feedUrls: [feedUrl],
      allowedLanguages: [language],
      primaryNewsSource: false,
      topicKeywords: splitTerms(raw?.topicKeywords || raw?.keywords),
      exclude: [...COMMON_EXCLUSIONS, ...splitTerms(raw?.exclude)],
      custom: true
    });
  }

  return { sources, warnings };
}

function cleanPreferenceList(value, maxItems, maxLength) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return Array.from(
    new Set(values.map((item) => String(item).trim().slice(0, maxLength)).filter(Boolean))
  ).slice(0, maxItems);
}

function preparePreferences(rawPreferences = {}) {
  return {
    likedTerms: cleanPreferenceList(rawPreferences?.likedTerms, MAX_PREFERENCE_TERMS, 80),
    dislikedTerms: cleanPreferenceList(rawPreferences?.dislikedTerms, MAX_PREFERENCE_TERMS, 80),
    likedTitles: cleanPreferenceList(rawPreferences?.likedTitles, MAX_FEEDBACK_TITLES, 220),
    dislikedTitles: cleanPreferenceList(rawPreferences?.dislikedTitles, MAX_FEEDBACK_TITLES, 220)
  };
}

function hasPreferenceSignals(preferences) {
  return Boolean(
    preferences.likedTerms.length ||
      preferences.dislikedTerms.length ||
      preferences.likedTitles.length ||
      preferences.dislikedTitles.length
  );
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
  const haystack = normalizeForMatch(`${item.title} ${item.link} ${item.description} ${item.articleSection || ""}`);
  return (source.exclude || []).some((term) => termMatches(haystack, term));
}

function matchesTopic(item, source) {
  if (source.requiredCategories?.length) {
    const section = normalizeForMatch(item.articleSection || "");
    if (!source.requiredCategories.some((term) => termMatches(section, term))) return false;
  }

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

function matchingTermCount(item, terms) {
  if (!terms || terms.length === 0) return 0;
  const haystack = normalizeForMatch(`${item.title} ${item.description} ${item.link}`);
  return terms.filter((term) => termMatches(haystack, term)).length;
}

function topicRelevanceScore(item, source) {
  if (source.requiredKeywordGroups?.length) {
    const matchedGroups = source.requiredKeywordGroups.filter((group) => matchingTermCount(item, group) > 0).length;
    return 18 + 17 * (matchedGroups / source.requiredKeywordGroups.length);
  }
  if (source.topicKeywords?.length) {
    const matches = matchingTermCount(item, source.topicKeywords);
    return 18 + Math.min(matches, 4) * 4.25;
  }
  return 26;
}

function freshnessScore(item, options, source) {
  if (!item.publishedAt) return source.allowUndatedItems ? 7 : 0;
  const ageHours = Math.max(0, (Date.now() - Date.parse(item.publishedAt)) / (60 * 60 * 1000));
  return Math.max(0, 25 * (1 - ageHours / Math.max(options.hours, 1)));
}

function contentQualityScore(item) {
  const length = stripHtml(item.description || "").length;
  const descriptionScore = length >= 320 ? 10 : length >= 160 ? 8 : length >= 80 ? 5 : length > 0 ? 2 : 0;
  const structureScore = item.from === "article" ? 3 : item.from === "feed" || item.from === "structured-page" ? 2 : 0;
  return Math.min(15, descriptionScore + structureScore + (item.publishedAt ? 2 : 0));
}

function interestScore(item, source) {
  const positive = Math.min(matchingTermCount(item, source.boostKeywords), 3) * 5;
  const negative = Math.min(matchingTermCount(item, source.deprioritizeKeywords), 2) * 8;
  return positive - negative;
}

function titleHistoryScore(item, titles, weight) {
  const closest = titles.reduce((score, title) => Math.max(score, similarity(item.title, title)), 0);
  return closest >= 0.3 ? closest * weight : 0;
}

function preferenceScore(item, preferences) {
  if (!preferences || !hasPreferenceSignals(preferences)) return 0;
  const likedTerms = Math.min(matchingTermCount(item, preferences.likedTerms), 3) * 4;
  const dislikedTerms = Math.min(matchingTermCount(item, preferences.dislikedTerms), 3) * 6;
  const likedHistory = titleHistoryScore(item, preferences.likedTitles, 10);
  const dislikedHistory = titleHistoryScore(item, preferences.dislikedTitles, 16);
  return likedTerms + likedHistory - dislikedTerms - dislikedHistory;
}

function itemPriorityScore(item, source, options, preferences = null) {
  if (!source) return -Infinity;
  return (
    topicRelevanceScore(item, source) +
    freshnessScore(item, options, source) +
    (source.primaryNewsSource ? 10 : 6) +
    contentQualityScore(item) +
    interestScore(item, source) +
    preferenceScore(item, preferences)
  );
}

function isAcceptable(item, source, options, allowUnknownDate = false) {
  if (!item.title || item.title.length < 12) return false;
  if (!item.link || !allowedHost(source, item.link)) return false;
  if (hasExcludedContent(item, source)) return false;
  if (!matchesTopic(item, source)) return false;
  if (!item.publishedAt && options.hours > 0 && !source.allowUndatedItems && !allowUnknownDate) return false;
  if (item.publishedAt && options.hours > 0) {
    const publishedTime = Date.parse(item.publishedAt);
    if (!Number.isFinite(publishedTime) || publishedTime > Date.now() + 6 * 60 * 60 * 1000) return false;
    const minTime = Date.now() - options.hours * 60 * 60 * 1000;
    if (publishedTime < minTime) return false;
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

function selectDiverseItems(items, maxItems, scoreItem, perSourceLimit = MAX_ITEMS_PER_SOURCE) {
  const counts = new Map();
  const selected = [];
  const remaining = [...items];

  while (selected.length < maxItems) {
    const eligible = remaining.filter((item) => (counts.get(item.source) || 0) < perSourceLimit);
    if (eligible.length === 0) break;
    let best = null;
    let bestScore = -Infinity;

    for (const item of eligible) {
      const closestSelected = selected.reduce(
        (closest, chosen) => Math.max(closest, similarity(item.title, chosen.title)),
        0
      );
      const sourceRepeatPenalty = (counts.get(item.source) || 0) * 3;
      const adjustedScore = scoreItem(item) - closestSelected * 12 - sourceRepeatPenalty;
      if (adjustedScore > bestScore) {
        best = item;
        bestScore = adjustedScore;
      }
    }

    selected.push(best);
    counts.set(best.source, (counts.get(best.source) || 0) + 1);
    remaining.splice(remaining.indexOf(best), 1);
  }

  return selected;
}

function selectPersonalizedItems(items, maxItems, sourceByName, options, preferences) {
  const personalizedScore = (item) =>
    itemPriorityScore(item, sourceByName.get(item.source), options, preferences);
  if (!hasPreferenceSignals(preferences) || maxItems < 3) {
    return selectDiverseItems(items, maxItems, personalizedScore);
  }

  const core = selectDiverseItems(items, maxItems - 1, personalizedScore);
  const coreSet = new Set(core.map((item) => `${item.source}|${item.link}`));
  const sourceCounts = new Map();
  for (const item of core) sourceCounts.set(item.source, (sourceCounts.get(item.source) || 0) + 1);

  const discovery = items
    .filter((item) => !coreSet.has(`${item.source}|${item.link}`))
    .filter((item) => Math.abs(preferenceScore(item, preferences)) < 0.01)
    .filter((item) => (sourceCounts.get(item.source) || 0) < MAX_ITEMS_PER_SOURCE)
    .filter((item) => core.every((chosen) => similarity(item.title, chosen.title) < 0.55))
    .sort(
      (a, b) =>
        itemPriorityScore(b, sourceByName.get(b.source), options) -
        itemPriorityScore(a, sourceByName.get(a.source), options)
    )[0];

  if (!discovery) return selectDiverseItems(items, maxItems, personalizedScore);
  return [...core, { ...discovery, discovery: true }];
}

function summarySentences(value, maxSentences, maxLength) {
  const sentences = stripHtml(value || "")
    .replace(/^Photo by [A-Z][A-Za-z'-]+(?: [A-Z][A-Za-z'-]+){0,3}\s+/i, "")
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
      const discoveryPart = item.discovery ? `${language === "en" ? "Discovery" : "Löytö"}: ` : "";
      lines.push(`${index + 1}. ${discoveryPart}${item.title} -- ${item.source}${datePart}`);
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
    maxPerArea: Math.min(Math.max(Number(search.get("max") || 5), 1), 10),
    mode: search.get("mode") === "wide" ? "wide" : "compact",
    language: search.get("language") === "en" ? "en" : "fi",
    hours: Math.min(Math.max(Number(search.get("hours") || 24), 1), 24 * 14),
    showLinks: search.get("links") !== "false",
    showTime: search.get("time") !== "false"
  };
}

function sourceStatus(resultCount, acceptableCount, warningCount) {
  if (resultCount === 0 && warningCount > 0) return "Ei vastaa";
  if (acceptableCount >= 3) return "Hyvä";
  if (acceptableCount > 0) return "Toimii, mutta rajallisesti";
  if (resultCount > 0) return "Ongelmallinen";
  return "Ei uutisia";
}

async function checkSourceHealth(options, customSources = []) {
  const custom = prepareCustomSources(customSources);
  const allSources = [...SOURCES, ...custom.sources];
  const activeSources = allSources.filter((source) => source.areas.some((area) => options.areas.includes(area)));
  const fetched = await Promise.all(activeSources.map(fetchSource));
  const sourceByName = new Map(allSources.map((source) => [source.name, source]));
  const healthArticles = [];
  for (const entry of fetched) {
    const source = sourceByName.get(entry.source);
    if (!source) continue;
    const candidates = entry.results
      .filter((item) => isAcceptable(item, source, options, true))
      .filter(needsArticleFetch)
      .slice(0, 3);
    healthArticles.push(...candidates);
  }
  const enrichedHealthArticles = await mapWithConcurrency(
    healthArticles,
    ARTICLE_FETCH_CONCURRENCY,
    (item) => enrichArticle(item, sourceByName.get(item.source))
  );
  const enrichedByKey = new Map(
    enrichedHealthArticles.map((item) => [`${item.source}|${item.link}`, item])
  );

  const results = fetched.map((entry) => {
    const source = sourceByName.get(entry.source);
    const acceptableItems = entry.results
      .map((item) => enrichedByKey.get(`${item.source}|${item.link}`) || item)
      .filter((item) => source && isAcceptable(item, source, options));
    const latest = acceptableItems
      .map((item) => item.publishedAt)
      .filter(Boolean)
      .sort()
      .at(-1);

    return {
      source: entry.source,
      areas: source?.areas || [],
      custom: Boolean(source?.custom),
      site: source?.site || "",
      feedUrls: source?.feedUrls || [],
      status: sourceStatus(entry.results.length, acceptableItems.length, entry.warnings.length),
      foundItems: entry.results.length,
      acceptableItems: acceptableItems.length,
      latest,
      warnings: entry.warnings
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    sourceCount: activeSources.length,
    customSourceCount: custom.sources.length,
    results,
    warnings: custom.warnings
  };
}

async function buildDigest(options, customSources = [], rawPreferences = {}) {
  const custom = prepareCustomSources(customSources);
  const preferences = preparePreferences(rawPreferences);
  const allSources = [...SOURCES, ...custom.sources];
  const cacheKey = JSON.stringify({
    options,
    preferences,
    customSources: custom.sources.map((source) => ({
      name: source.name,
      areas: source.areas,
      site: source.site,
      feedUrls: source.feedUrls,
      allowedLanguages: source.allowedLanguages,
      topicKeywords: source.topicKeywords
    }))
  });
  if (cachedDigest && cachedDigest.key === cacheKey && Date.now() - cachedDigest.createdAt < CACHE_TTL_MS) {
    return cachedDigest.payload;
  }

  const activeSources = allSources.filter((source) => source.areas.some((area) => options.areas.includes(area)));
  const fetched = await Promise.all(activeSources.map(fetchSource));
  const sourceByName = new Map(allSources.map((source) => [source.name, source]));
  const warnings = [...custom.warnings, ...fetched.flatMap((entry) => entry.warnings)];
  const notes = activeSources.filter((source) => source.note).map((source) => `${source.name}: ${source.note}`);
  const selectedAreas = AREAS.filter((area) => options.areas.includes(area.id));
  const candidatesByArea = new Map();

  for (const area of selectedAreas) {
    const candidates = fetched
      .flatMap((entry) => entry.results)
      .filter((item) => item.areaCandidates.includes(area.id))
      .filter((item) => {
        const source = sourceByName.get(item.source);
        return source && isAcceptable(item, source, options, true);
      })
      .sort((a, b) => {
        const aScore = itemPriorityScore(a, sourceByName.get(a.source), options, preferences);
        const bScore = itemPriorityScore(b, sourceByName.get(b.source), options, preferences);
        if (aScore !== bScore) return bScore - aScore;
        const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
        const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
        return bTime - aTime;
      });
    candidatesByArea.set(area.id, dedupe(candidates).items.slice(0, MAX_CANDIDATES_PER_AREA));
  }

  const articlesToFetch = [];
  const seenArticleKeys = new Set();
  for (const area of selectedAreas) {
    const candidates = candidatesByArea.get(area.id) || [];
    let areaFetches = 0;
    for (const item of candidates) {
      if (!needsArticleFetch(item) || areaFetches >= MAX_ARTICLE_FETCHES_PER_AREA) continue;
      const key = `${item.source}|${item.link}`;
      if (seenArticleKeys.has(key)) continue;
      seenArticleKeys.add(key);
      articlesToFetch.push(item);
      areaFetches += 1;
    }
  }

  const enrichedArticles = await mapWithConcurrency(articlesToFetch, ARTICLE_FETCH_CONCURRENCY, (item) =>
    enrichArticle(item, sourceByName.get(item.source))
  );
  const enrichedByKey = new Map(
    enrichedArticles.map((item) => [`${item.source}|${item.link}`, item])
  );

  const sections = selectedAreas.map((area) => {
    const areaItems = (candidatesByArea.get(area.id) || [])
      .map((item) => enrichedByKey.get(`${item.source}|${item.link}`) || item)
      .filter((item) => {
        const source = sourceByName.get(item.source);
        return source && isAcceptable(item, source, options);
      })
      .sort((a, b) => {
        const aScore = itemPriorityScore(a, sourceByName.get(a.source), options, preferences);
        const bScore = itemPriorityScore(b, sourceByName.get(b.source), options, preferences);
        if (aScore !== bScore) return bScore - aScore;
        return (Date.parse(b.publishedAt || 0) || 0) - (Date.parse(a.publishedAt || 0) || 0);
      });

    const deduped = dedupe(areaItems);
    warnings.push(...deduped.duplicateNotes.slice(0, 6));

    const limitedItems = selectPersonalizedItems(
      deduped.items,
      options.maxPerArea,
      sourceByName,
      options,
      preferences
    );

    const items = limitedItems.map((item) => ({
      ...item,
      score: Math.round(itemPriorityScore(item, sourceByName.get(item.source), options, preferences)),
      personalized: preferenceScore(item, preferences) > 0,
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
    personalizationActive: hasPreferenceSignals(preferences),
    sections,
    warnings: Array.from(new Set([...warnings, ...notes])).slice(0, 30),
    markdown: buildMarkdown(sections, options, generatedAt)
  };

  cachedDigest = { key: cacheKey, createdAt: Date.now(), payload };
  return payload;
}

module.exports = {
  buildDigest,
  checkSourceHealth,
  cleanError,
  parseOptions,
  prepareCustomSources,
  preparePreferences,
  __testing: {
    isAcceptable,
    itemPriorityScore,
    parseArticlePage,
    parseFeed,
    parseListingPage,
    preferenceScore,
    selectDiverseItems,
    selectPersonalizedItems
  }
};
