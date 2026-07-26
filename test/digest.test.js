const test = require("node:test");
const assert = require("node:assert/strict");
const { __testing, preparePreferences } = require("../lib/digest");

const source = {
  name: "Example News",
  areas: ["suomi"],
  site: "https://example.com",
  allowedLanguages: ["en"],
  primaryNewsSource: true,
  exclude: ["opinion"],
  topicKeywords: ["photography", "exhibition"],
  boostKeywords: ["exhibition"],
  deprioritizeKeywords: ["lens"]
};

const options = {
  areas: ["suomi"],
  maxPerArea: 5,
  mode: "compact",
  language: "fi",
  hours: 24,
  showLinks: true,
  showTime: true
};

test("listing parser prefers structured articles and ignores navigation links", () => {
  const html = `
    <a href="/main-content/skip-navigation">Skip to main content and navigation</a>
    <script type="application/ld+json">
      {"@type":"NewsArticle","headline":"Major photography exhibition opens this weekend","url":"/news/photo-show","description":"A large documentary photography exhibition opens to the public.","datePublished":"2026-07-26T08:00:00Z"}
    </script>`;
  const items = __testing.parseListingPage(html, source, "https://example.com/news");
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Major photography exhibition opens this weekend");
  assert.equal(items[0].publishedAt, "2026-07-26T08:00:00.000Z");
});

test("article parser extracts article body, section and publication time", () => {
  const item = {
    title: "Original title about photography",
    link: "https://example.com/news/photo-show",
    description: "",
    publishedAt: null,
    source: source.name,
    from: "generic-listing"
  };
  const html = `
    <meta property="article:section" content="Culture">
    <article>
      <h1>Documentary photography exhibition opens</h1>
      <time datetime="2026-07-26T09:30:00Z"></time>
      <p>The exhibition brings together recent documentary projects from six photographers.</p>
      <p>It will remain open through September at the city museum.</p>
    </article>`;
  const parsed = __testing.parseArticlePage(html, item);
  assert.match(parsed.description, /six photographers/);
  assert.equal(parsed.publishedAt, "2026-07-26T09:30:00.000Z");
  assert.equal(parsed.articleSection, "Culture");
});

test("feed parser retains RSS and Atom categories for topic validation", () => {
  const xml = `
    <rss><channel><item>
      <title>Company releases a new artificial intelligence system</title>
      <link>https://example.com/news/ai-system</link>
      <description>The system is intended for business customers.</description>
      <pubDate>Sun, 26 Jul 2026 08:00:00 GMT</pubDate>
      <category>Artificial Intelligence</category>
      <category term="Technology" />
    </item></channel></rss>`;
  const items = __testing.parseFeed(xml, source, "https://example.com/feed.xml");
  assert.equal(items.length, 1);
  assert.match(items[0].articleSection, /Artificial Intelligence/);
  assert.match(items[0].articleSection, /Technology/);
});

test("unknown publication time is rejected unless the source explicitly permits it", () => {
  const item = {
    title: "New photography exhibition opens at the museum",
    link: "https://example.com/news/photo-show",
    description: "The photography exhibition presents documentary work.",
    publishedAt: null
  };
  assert.equal(__testing.isAcceptable(item, source, options), false);
  assert.equal(__testing.isAcceptable(item, { ...source, allowUndatedItems: true }, options), true);
});

test("required source category blocks unrelated items from a broad feed", () => {
  const categorizedSource = {
    ...source,
    requiredCategories: ["artificial intelligence"],
    topicKeywords: ["ai", "artificial intelligence"]
  };
  const item = {
    title: "New camera model includes several AI editing features",
    link: "https://example.com/news/camera",
    description: "The model uses artificial intelligence for editing.",
    publishedAt: new Date().toISOString(),
    articleSection: "Cameras"
  };
  assert.equal(__testing.isAcceptable(item, categorizedSource, options), false);
  assert.equal(
    __testing.isAcceptable({ ...item, articleSection: "Artificial Intelligence" }, categorizedSource, options),
    true
  );
});

test("ranking rewards freshness and cultural photography over technical products", () => {
  const now = Date.now();
  const art = {
    title: "Photography exhibition announces international award winners",
    link: "https://example.com/news/photo-awards",
    description: "The exhibition presents the winning documentary photography projects.",
    publishedAt: new Date(now - 60 * 60 * 1000).toISOString(),
    from: "feed"
  };
  const technical = {
    title: "New portrait lens announced for mirrorless camera bodies",
    link: "https://example.com/news/portrait-lens",
    description: "The camera lens includes a new autofocus motor and updated specifications.",
    publishedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    from: "feed"
  };
  assert.ok(
    __testing.itemPriorityScore(art, source, options) >
      __testing.itemPriorityScore(technical, source, options)
  );
});

test("diverse selection limits a source and avoids nearly identical topics", () => {
  const items = [
    { source: "A", title: "Company launches a new artificial intelligence model", score: 95 },
    { source: "B", title: "Company unveils its new artificial intelligence model", score: 94 },
    { source: "A", title: "Museum opens a major documentary photography exhibition", score: 90 },
    { source: "A", title: "Rock band announces a new studio album", score: 89 },
    { source: "C", title: "Streaming service confirms a new drama series", score: 88 }
  ];
  const selected = __testing.selectDiverseItems(items, 4, (item) => item.score);
  assert.ok(selected.filter((item) => item.source === "A").length <= 2);
  assert.ok(selected.some((item) => item.source === "C"));
});

test("preference profile is bounded and raises matching stories", () => {
  const preferences = preparePreferences({
    likedTerms: ["documentary photography", "documentary photography"],
    dislikedTerms: ["camera lens"],
    likedTitles: ["Museum opens a documentary photography exhibition"]
  });
  assert.deepEqual(preferences.likedTerms, ["documentary photography"]);

  const matching = {
    title: "New documentary photography exhibition opens at museum",
    description: "Six photographers present long-term documentary projects.",
    link: "https://example.com/news/exhibition"
  };
  const unwanted = {
    title: "Manufacturer announces a new camera lens",
    description: "The camera lens has a faster autofocus motor.",
    link: "https://example.com/news/lens"
  };
  assert.ok(__testing.preferenceScore(matching, preferences) > 0);
  assert.ok(__testing.preferenceScore(unwanted, preferences) < 0);
});

test("personalized selection keeps one neutral discovery outside the profile", () => {
  const preferences = preparePreferences({ likedTerms: ["photography"] });
  const now = new Date().toISOString();
  const items = [
    { source: "A", title: "Photography exhibition opens downtown", description: "photography", link: "https://example.com/1", publishedAt: now, from: "feed" },
    { source: "B", title: "Photography award announces new winners", description: "photography", link: "https://example.com/2", publishedAt: now, from: "feed" },
    { source: "C", title: "Rock group announces an ambitious new album", description: "music release", link: "https://example.com/3", publishedAt: now, from: "feed" },
    { source: "D", title: "Photography museum acquires historic archive", description: "photography", link: "https://example.com/4", publishedAt: now, from: "feed" }
  ];
  const sourceByName = new Map(
    ["A", "B", "C", "D"].map((name) => [name, { ...source, name, topicKeywords: [] }])
  );
  const selected = __testing.selectPersonalizedItems(items, 3, sourceByName, options, preferences);
  assert.equal(selected.length, 3);
  assert.equal(selected.filter((item) => item.discovery).length, 1);
  assert.equal(selected.find((item) => item.discovery).source, "C");
});
