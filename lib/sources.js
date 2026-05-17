const AREAS = [
  { id: "suomi", name: "Suomi" },
  { id: "usa", name: "USA" },
  { id: "easttennessee", name: "East Tennessee" },
  { id: "maailma", name: "Maailma" },
  { id: "talous", name: "Talous" },
  { id: "tekoaly", name: "Tekoäly" },
  { id: "valokuvaus", name: "Valokuvaus" },
  { id: "suoratoistoelokuvat", name: "Suoratoisto ja elokuvat" },
  { id: "musiikki", name: "Musiikki" }
];

const COMMON_EXCLUSIONS = [
  "opinion",
  "opinions",
  "column",
  "columns",
  "editorial",
  "commentary",
  "analysis",
  "live",
  "live updates",
  "seuranta",
  "letter",
  "letters",
  "blog",
  "blogs",
  "podcast",
  "sponsored",
  "advertorial",
  "native-ad",
  "paid post",
  "partner content",
  "review",
  "reviews",
  "should you",
  "video",
  "videos",
  "watch",
  "hands-on",
  "how to",
  "how-to",
  "guide",
  "buying guide",
  "deal",
  "deals",
  "coupon",
  "mielipide",
  "kommentti",
  "kolumni",
  "paakirjoitus",
  "pääkirjoitus",
  "blogi",
  "sponsoroitu",
  "mainos",
  "arvostelu",
  "testi",
  "opas"
];

const MUSIC_EXCLUSIONS = [
  ...COMMON_EXCLUSIONS.filter((term) => term !== "live"),
  "ranking",
  "ranked",
  "best of",
  "interview",
  "award",
  "awards",
  "win",
  "wins",
  "playlist",
  "rare look",
  "tour",
  "tour dates",
  "european tour",
  "us tour",
  "anniversary",
  "reissue review"
];

const MUSIC_GENRE_TERMS = [
  "rock",
  "blues",
  "blues-rock",
  "blues rock",
  "classic rock",
  "hard rock"
];

const MUSIC_RELEASE_TERMS = [
  "album",
  "single",
  "release",
  "released",
  "lp",
  "ep",
  "new single",
  "new song",
  "premiere",
  "premieres",
  "shares",
  "drops",
  "unveils",
  "forthcoming",
  "deluxe",
  "out now"
];

const EAST_TENNESSEE_TERMS = [
  "knoxville",
  "knox county",
  "east tennessee",
  "pigeon forge",
  "gatlinburg",
  "great smoky mountains",
  "great smoky mountains national park",
  "smoky mountains",
  "smokies",
  "sevier county",
  "sevierville",
  "dollywood",
  "newfound gap",
  "cades cove",
  "wears valley"
];

const STREAMING_AND_MOVIE_EXCLUSIONS = [
  ...COMMON_EXCLUSIONS,
  "recap",
  "spoiler",
  "spoilers",
  "ending explained",
  "explained",
  "interview",
  "awards",
  "box office",
  "lipputulot",
  "traileri",
  "trailer",
  "teaser",
  "behind the scenes"
];

const STREAMING_SERVICE_TERMS = [
  "netflix",
  "apple tv",
  "apple tv+",
  "hbo max",
  "max",
  "yle areena",
  "areena",
  "prime video",
  "primevideo",
  "amazon prime",
  "amazon mgm"
];

const FINNISH_THEATER_TERMS = [
  "ensi-ilta",
  "ensi-illat",
  "elokuvateatteri",
  "elokuvateattereihin",
  "teattereihin",
  "suomen elokuvateattereihin",
  "finnkino",
  "suomessa",
  "levitykseen"
];

const STREAMING_RELEASE_TERMS = [
  "new on",
  "new to",
  "new movies",
  "new series",
  "coming to",
  "coming soon",
  "premiere",
  "premieres",
  "premiering",
  "release",
  "released",
  "returns",
  "renewed",
  "season",
  "series",
  "film",
  "movie",
  "lisättiin",
  "lisatty",
  "tulossa",
  "uudet",
  "uutuudet",
  "ensi-ilta",
  "ensi-illat",
  "julkaistaan",
  "katsottavaksi",
  "suoratoistoon",
  "elokuvateattereihin"
];

const PHOTOGRAPHY_ART_TERMS = [
  "exhibition",
  "exhibitions",
  "exhibit",
  "gallery",
  "galleries",
  "museum",
  "museums",
  "photobook",
  "photo book",
  "contest",
  "contests",
  "competition",
  "competitions",
  "award",
  "awards",
  "winner",
  "winners",
  "finalist",
  "finalists",
  "festival",
  "portrait",
  "portraits",
  "documentary photography",
  "photojournalism",
  "photographer",
  "photographers",
  "project",
  "series",
  "archive",
  "collection",
  "prints"
];

const PHOTOGRAPHY_TECH_TERMS = [
  "camera",
  "cameras",
  "lens",
  "lenses",
  "sensor",
  "sensors",
  "firmware",
  "megapixel",
  "mirrorless",
  "dslr",
  "autofocus",
  "adapter",
  "mount",
  "raw",
  "body",
  "specs",
  "specifications",
  "rumor",
  "rumour",
  "leaked",
  "patent",
  "price"
];

const PHOTOGRAPHY_TOPIC_TERMS = [
  ...PHOTOGRAPHY_ART_TERMS,
  "photo",
  "photos",
  "photography",
  "image",
  "images",
  "camera",
  "lens"
];

const SOURCES = [
  {
    name: "Yle",
    areas: ["suomi"],
    site: "https://yle.fi",
    feedUrls: ["https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_UUTISET"],
    allowedLanguages: ["fi"],
    primaryNewsSource: true,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "Helsingin Sanomat",
    areas: ["suomi"],
    site: "https://www.hs.fi",
    feedUrls: ["https://www.hs.fi/rss/tuoreimmat.xml"],
    allowedLanguages: ["fi"],
    primaryNewsSource: true,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "Iltalehti",
    areas: ["suomi"],
    site: "https://www.iltalehti.fi",
    feedUrls: ["https://www.iltalehti.fi/rss/uutiset.xml"],
    allowedLanguages: ["fi"],
    primaryNewsSource: true,
    exclude: COMMON_EXCLUSIONS,
    replaces: "STT",
    note: "Korvaa STT:n, koska STT:n avoin uutissyote ei ole talla hetkella kaytettavissa ilman rajoituksia."
  },
  {
    name: "Ilta-Sanomat",
    areas: ["suomi"],
    site: "https://www.is.fi",
    feedUrls: ["https://www.is.fi/rss/tuoreimmat.xml"],
    allowedLanguages: ["fi"],
    primaryNewsSource: true,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "CNN",
    areas: ["usa"],
    site: "https://www.cnn.com",
    feedUrls: [
      "http://rss.cnn.com/rss/cnn_latest.rss",
      "http://rss.cnn.com/rss/edition.rss"
    ],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "NPR",
    areas: ["usa"],
    site: "https://www.npr.org",
    feedUrls: ["https://feeds.npr.org/1001/rss.xml", "https://feeds.npr.org/1003/rss.xml"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    exclude: COMMON_EXCLUSIONS,
    replaces: "AP",
    note: "Korvaa AP:n, koska AP:n julkinen sivu ei tarjonnut sovellukselle luotettavaa parsittavaa uutissyotetta."
  },
  {
    name: "CBS",
    areas: ["usa"],
    site: "https://www.cbsnews.com",
    feedUrls: [
      "https://www.cbsnews.com/latest/rss/main",
      "https://www.cbsnews.com/latest/rss/us"
    ],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "NBC",
    areas: ["usa"],
    site: "https://www.nbcnews.com",
    feedUrls: ["https://feeds.nbcnews.com/nbcnews/public/news"],
    pageUrls: ["https://www.nbcnews.com/us-news"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "ABC",
    areas: ["usa"],
    site: "https://abcnews.go.com",
    feedUrls: [
      "https://abcnews.go.com/abcnews/topstories",
      "https://abcnews.go.com/abcnews/usheadlines"
    ],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "The New York Times",
    areas: ["usa"],
    site: "https://www.nytimes.com",
    feedUrls: ["https://rss.nytimes.com/services/xml/rss/nyt/US.xml"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "WATE 6",
    areas: ["easttennessee"],
    site: "https://www.wate.com",
    feedUrls: ["https://www.wate.com/news/local-news/feed/"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    topicKeywords: EAST_TENNESSEE_TERMS,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "WVLT",
    areas: ["easttennessee"],
    site: "https://www.wvlt.tv",
    feedUrls: ["https://www.wvlt.tv/arc/outboundfeeds/rss/category/news/?outputType=xml"],
    pageUrls: ["https://www.wvlt.tv/news/sevier-county-bureau/"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    topicKeywords: EAST_TENNESSEE_TERMS,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "Great Smoky Mountains National Park",
    areas: ["easttennessee"],
    site: "https://www.nps.gov",
    feedUrls: ["https://www.nps.gov/feeds/getNewsRSS.htm?id=grsm"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    topicKeywords: EAST_TENNESSEE_TERMS,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "Knoxville Daily Sun",
    areas: ["easttennessee"],
    site: "https://www.knoxvilledailysun.com",
    feedUrls: ["https://www.knoxvilledailysun.com/rss.xml"],
    allowedLanguages: ["en"],
    primaryNewsSource: false,
    topicKeywords: EAST_TENNESSEE_TERMS,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "Knoxville Focus",
    areas: ["easttennessee"],
    site: "https://knoxfocus.com",
    feedUrls: ["https://feeds.feedburner.com/KnoxFocus"],
    allowedLanguages: ["en"],
    primaryNewsSource: false,
    topicKeywords: EAST_TENNESSEE_TERMS,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "Smoky Mountain News",
    areas: ["easttennessee"],
    site: "https://smokymountainnews.com",
    feedUrls: ["https://smokymountainnews.com/news/itemlist?format=feed&type=rss"],
    allowedLanguages: ["en"],
    primaryNewsSource: false,
    topicKeywords: EAST_TENNESSEE_TERMS,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "Euronews",
    areas: ["maailma"],
    site: "https://www.euronews.com",
    feedUrls: ["https://www.euronews.com/rss?level=theme&name=news"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    exclude: COMMON_EXCLUSIONS,
    replaces: "Reuters",
    note: "Korvaa Reutersin, koska Reutersin avoin sivu esti automaattisen haun."
  },
  {
    name: "BBC",
    areas: ["maailma"],
    site: "https://www.bbc.com",
    feedUrls: ["https://feeds.bbci.co.uk/news/world/rss.xml"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "Al Jazeera",
    areas: ["maailma"],
    site: "https://www.aljazeera.com",
    feedUrls: ["https://www.aljazeera.com/xml/rss/all.xml"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "DW",
    areas: ["maailma"],
    site: "https://www.dw.com",
    feedUrls: ["https://rss.dw.com/rdf/rss-en-top"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "The Guardian",
    areas: ["maailma"],
    site: "https://www.theguardian.com",
    feedUrls: ["https://www.theguardian.com/world/rss"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "CNBC",
    areas: ["talous"],
    site: "https://www.cnbc.com",
    feedUrls: ["https://www.cnbc.com/id/100003114/device/rss/rss.html"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    topicKeywords: ["economy", "economic", "business", "market", "finance", "trade", "inflation", "rates"],
    exclude: COMMON_EXCLUSIONS,
    replaces: "AFP",
    note: "Korvaa AFP:n, koska AFP:n avoin sivu ei palauttanut sovellukselle parsittavia uutisartikkeleita."
  },
  {
    name: "Bloomberg",
    areas: ["talous"],
    site: "https://www.bloomberg.com",
    feedUrls: ["https://feeds.bloomberg.com/markets/news.rss", "https://feeds.bloomberg.com/economics/news.rss"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "MIT Technology Review",
    areas: ["tekoaly"],
    site: "https://www.technologyreview.com",
    feedUrls: ["https://www.technologyreview.com/topic/artificial-intelligence/feed/"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    topicKeywords: ["ai", "artificial intelligence", "machine learning", "model", "llm"],
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "The Verge / Artificial Intelligence",
    areas: ["tekoaly"],
    site: "https://www.theverge.com/artificial-intelligence",
    feedUrls: ["https://www.theverge.com/rss/index.xml"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    topicKeywords: ["ai", "artificial intelligence", "machine learning", "model", "llm"],
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "AI Business",
    areas: ["tekoaly"],
    site: "https://aibusiness.com",
    feedUrls: ["https://aibusiness.com/rss.xml", "https://aibusiness.com/feed"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    topicKeywords: ["ai", "artificial intelligence", "machine learning", "model", "llm"],
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "Ars Technica / AI",
    areas: ["tekoaly"],
    site: "https://arstechnica.com/information-technology/ai",
    feedUrls: ["https://arstechnica.com/information-technology/ai/feed/"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    topicKeywords: ["ai", "artificial intelligence", "machine learning", "model", "llm"],
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "TechCrunch / AI",
    areas: ["tekoaly"],
    site: "https://techcrunch.com/category/artificial-intelligence",
    feedUrls: ["https://techcrunch.com/category/artificial-intelligence/feed/"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    topicKeywords: ["ai", "artificial intelligence", "machine learning", "model", "llm"],
    exclude: COMMON_EXCLUSIONS,
    replaces: "The Decoder",
    note: "Korvaa The Decoderin, koska sen RSS-syote aikakatkaisi toistuvasti testiajossa."
  },
  {
    name: "DPReview",
    areas: ["valokuvaus"],
    site: "https://www.dpreview.com",
    feedUrls: ["https://www.dpreview.com/feeds/news.xml"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    topicKeywords: PHOTOGRAPHY_TOPIC_TERMS,
    boostKeywords: PHOTOGRAPHY_ART_TERMS,
    deprioritizeKeywords: PHOTOGRAPHY_TECH_TERMS,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "PetaPixel",
    areas: ["valokuvaus"],
    site: "https://petapixel.com",
    feedUrls: ["https://petapixel.com/feed/"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    topicKeywords: PHOTOGRAPHY_TOPIC_TERMS,
    boostKeywords: PHOTOGRAPHY_ART_TERMS,
    deprioritizeKeywords: PHOTOGRAPHY_TECH_TERMS,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "Fstoppers",
    areas: ["valokuvaus"],
    site: "https://fstoppers.com",
    feedUrls: ["https://fstoppers.com/feed"],
    allowedLanguages: ["en"],
    primaryNewsSource: false,
    topicKeywords: PHOTOGRAPHY_TOPIC_TERMS,
    boostKeywords: PHOTOGRAPHY_ART_TERMS,
    deprioritizeKeywords: PHOTOGRAPHY_TECH_TERMS,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "Digital Camera World",
    areas: ["valokuvaus"],
    site: "https://www.digitalcameraworld.com",
    feedUrls: ["https://www.digitalcameraworld.com/feeds.xml"],
    allowedLanguages: ["en"],
    primaryNewsSource: false,
    topicKeywords: PHOTOGRAPHY_TOPIC_TERMS,
    boostKeywords: PHOTOGRAPHY_ART_TERMS,
    deprioritizeKeywords: PHOTOGRAPHY_TECH_TERMS,
    exclude: COMMON_EXCLUSIONS,
    replaces: "DIY Photography",
    note: "Korvaa DIY Photographyn, koska sen RSS-syote ei vastannut Node-haussa luotettavasti."
  },
  {
    name: "The Phoblographer",
    areas: ["valokuvaus"],
    site: "https://www.thephoblographer.com",
    feedUrls: ["https://www.thephoblographer.com/feed/"],
    allowedLanguages: ["en"],
    primaryNewsSource: false,
    topicKeywords: PHOTOGRAPHY_TOPIC_TERMS,
    boostKeywords: PHOTOGRAPHY_ART_TERMS,
    deprioritizeKeywords: PHOTOGRAPHY_TECH_TERMS,
    exclude: COMMON_EXCLUSIONS
  },
  {
    name: "Netflix Tudum",
    areas: ["suoratoistoelokuvat"],
    site: "https://www.netflix.com",
    pageUrls: ["https://www.netflix.com/tudum/articles/new-on-netflix"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    requiredKeywordGroups: [["netflix"], STREAMING_RELEASE_TERMS],
    exclude: STREAMING_AND_MOVIE_EXCLUSIONS
  },
  {
    name: "What's on Netflix",
    areas: ["suoratoistoelokuvat"],
    site: "https://www.whats-on-netflix.com",
    feedUrls: [
      "https://www.whats-on-netflix.com/whats-new/feed/",
      "https://www.whats-on-netflix.com/feed/"
    ],
    allowedLanguages: ["en"],
    primaryNewsSource: false,
    requiredKeywordGroups: [["netflix"], STREAMING_RELEASE_TERMS],
    exclude: STREAMING_AND_MOVIE_EXCLUSIONS
  },
  {
    name: "Apple TV Press",
    areas: ["suoratoistoelokuvat"],
    site: "https://www.apple.com",
    pageUrls: ["https://www.apple.com/tv-pr/news/"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    requiredKeywordGroups: [STREAMING_RELEASE_TERMS],
    exclude: STREAMING_AND_MOVIE_EXCLUSIONS
  },
  {
    name: "Max Press",
    areas: ["suoratoistoelokuvat"],
    site: "https://press.wbd.com",
    pageUrls: ["https://press.wbd.com/us/max"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    requiredKeywordGroups: [["max", "hbo", "hbo max"], STREAMING_RELEASE_TERMS],
    exclude: STREAMING_AND_MOVIE_EXCLUSIONS
  },
  {
    name: "Prime Video Press",
    areas: ["suoratoistoelokuvat"],
    site: "https://press.aboutamazon.com",
    pageUrls: ["https://press.aboutamazon.com/prime-video"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    requiredKeywordGroups: [["prime video", "amazon mgm", "amazon prime"], STREAMING_RELEASE_TERMS],
    exclude: STREAMING_AND_MOVIE_EXCLUSIONS
  },
  {
    name: "About Amazon / Entertainment",
    areas: ["suoratoistoelokuvat"],
    site: "https://www.aboutamazon.com",
    feedUrls: ["https://www.aboutamazon.com/news/entertainment/rss"],
    allowedLanguages: ["en"],
    primaryNewsSource: false,
    requiredKeywordGroups: [["prime video", "amazon mgm", "amazon prime"], STREAMING_RELEASE_TERMS],
    exclude: STREAMING_AND_MOVIE_EXCLUSIONS
  },
  {
    name: "Muropaketti / Elokuvat",
    areas: ["suoratoistoelokuvat"],
    site: "https://muropaketti.com",
    feedUrls: ["https://muropaketti.com/feed/"],
    pageUrls: ["https://muropaketti.com/elokuvat/elokuvauutiset/"],
    allowedLanguages: ["fi"],
    primaryNewsSource: false,
    requiredKeywordGroups: [[...STREAMING_SERVICE_TERMS, ...FINNISH_THEATER_TERMS], STREAMING_RELEASE_TERMS],
    exclude: STREAMING_AND_MOVIE_EXCLUSIONS
  },
  {
    name: "Episodi",
    areas: ["suoratoistoelokuvat"],
    site: "https://www.episodi.fi",
    feedUrls: ["https://www.episodi.fi/uutiset/feed/"],
    allowedLanguages: ["fi"],
    primaryNewsSource: false,
    requiredKeywordGroups: [[...STREAMING_SERVICE_TERMS, ...FINNISH_THEATER_TERMS], STREAMING_RELEASE_TERMS],
    exclude: STREAMING_AND_MOVIE_EXCLUSIONS
  },
  {
    name: "Elokuvauutiset",
    areas: ["suoratoistoelokuvat"],
    site: "https://www.elokuvauutiset.fi",
    pageUrls: ["https://www.elokuvauutiset.fi/site/ensi-illat"],
    allowedLanguages: ["fi"],
    primaryNewsSource: true,
    requiredKeywordGroups: [FINNISH_THEATER_TERMS],
    exclude: STREAMING_AND_MOVIE_EXCLUSIONS
  },
  {
    name: "JustWatch Suomi",
    areas: ["suoratoistoelokuvat"],
    site: "https://www.justwatch.com",
    pageUrls: ["https://www.justwatch.com/fi/uudet"],
    allowedLanguages: ["fi", "en"],
    primaryNewsSource: false,
    requiredKeywordGroups: [STREAMING_RELEASE_TERMS],
    exclude: STREAMING_AND_MOVIE_EXCLUSIONS
  },
  {
    name: "Blues Rock Review",
    areas: ["musiikki"],
    site: "https://bluesrockreview.com",
    feedUrls: ["https://bluesrockreview.com/feed"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    requiredKeywordGroups: [MUSIC_GENRE_TERMS, MUSIC_RELEASE_TERMS],
    exclude: MUSIC_EXCLUSIONS
  },
  {
    name: "Rock & Blues Muse",
    areas: ["musiikki"],
    site: "https://www.rockandbluesmuse.com",
    feedUrls: ["https://www.rockandbluesmuse.com/feed/"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    requiredKeywordGroups: [MUSIC_GENRE_TERMS, MUSIC_RELEASE_TERMS],
    exclude: MUSIC_EXCLUSIONS
  },
  {
    name: "Ultimate Classic Rock",
    areas: ["musiikki"],
    site: "https://ultimateclassicrock.com",
    feedUrls: ["https://ultimateclassicrock.com/feed/"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    requiredKeywordGroups: [MUSIC_GENRE_TERMS, MUSIC_RELEASE_TERMS],
    exclude: MUSIC_EXCLUSIONS
  },
  {
    name: "Louder / Classic Rock",
    areas: ["musiikki"],
    site: "https://www.loudersound.com",
    feedUrls: ["https://www.loudersound.com/feeds/tag/classic-rock"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    requiredKeywordGroups: [MUSIC_GENRE_TERMS, MUSIC_RELEASE_TERMS],
    exclude: MUSIC_EXCLUSIONS
  },
  {
    name: "Blabbermouth",
    areas: ["musiikki"],
    site: "https://blabbermouth.net",
    feedUrls: ["https://blabbermouth.net/feed"],
    allowedLanguages: ["en"],
    primaryNewsSource: false,
    requiredKeywordGroups: [MUSIC_GENRE_TERMS, MUSIC_RELEASE_TERMS],
    exclude: MUSIC_EXCLUSIONS
  },
  {
    name: "MusicRadar",
    areas: ["musiikki"],
    site: "https://www.musicradar.com",
    feedUrls: ["https://www.musicradar.com/rss"],
    allowedLanguages: ["en"],
    primaryNewsSource: false,
    requiredKeywordGroups: [MUSIC_GENRE_TERMS, MUSIC_RELEASE_TERMS],
    exclude: MUSIC_EXCLUSIONS
  },
  {
    name: "NME / Music News",
    areas: ["musiikki"],
    site: "https://www.nme.com",
    feedUrls: ["https://www.nme.com/news/music/feed"],
    allowedLanguages: ["en"],
    primaryNewsSource: false,
    requiredKeywordGroups: [MUSIC_GENRE_TERMS, MUSIC_RELEASE_TERMS],
    exclude: MUSIC_EXCLUSIONS
  },
  {
    name: "Guitar World",
    areas: ["musiikki"],
    site: "https://www.guitarworld.com",
    feedUrls: ["https://www.guitarworld.com/feeds.xml"],
    allowedLanguages: ["en"],
    primaryNewsSource: false,
    requiredKeywordGroups: [MUSIC_GENRE_TERMS, MUSIC_RELEASE_TERMS],
    exclude: MUSIC_EXCLUSIONS
  },
  {
    name: "American Songwriter",
    areas: ["musiikki"],
    site: "https://americansongwriter.com",
    feedUrls: ["https://americansongwriter.com/feed/"],
    allowedLanguages: ["en"],
    primaryNewsSource: false,
    requiredKeywordGroups: [MUSIC_GENRE_TERMS, MUSIC_RELEASE_TERMS],
    exclude: MUSIC_EXCLUSIONS
  },
  {
    name: "Louder / Blues",
    areas: ["musiikki"],
    site: "https://www.loudersound.com",
    feedUrls: ["https://www.loudersound.com/feeds/tag/blues"],
    allowedLanguages: ["en"],
    primaryNewsSource: true,
    requiredKeywordGroups: [MUSIC_GENRE_TERMS, MUSIC_RELEASE_TERMS],
    exclude: MUSIC_EXCLUSIONS
  }
];

module.exports = { AREAS, SOURCES, COMMON_EXCLUSIONS };
