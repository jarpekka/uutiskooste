const areaControls = document.querySelector("#areaControls");
const resetAreasButton = document.querySelector("#resetAreasButton");
const refreshButton = document.querySelector("#refreshButton");
const copyButton = document.querySelector("#copyButton");
const downloadMarkdownButton = document.querySelector("#downloadMarkdownButton");
const downloadTextButton = document.querySelector("#downloadTextButton");
const downloadHtmlButton = document.querySelector("#downloadHtmlButton");
const digestElement = document.querySelector("#digest");
const warningsElement = document.querySelector("#warnings");
const sectionJumpPanel = document.querySelector("#sectionJumpPanel");
const loadingState = document.querySelector("#loadingState");
const metaState = document.querySelector("#metaState");
const maxPerArea = document.querySelector("#maxPerArea");
const summaryMode = document.querySelector("#summaryMode");
const timeLimit = document.querySelector("#timeLimit");
const language = document.querySelector("#language");
const showLinks = document.querySelector("#showLinks");
const showTime = document.querySelector("#showTime");
const sourceSummary = document.querySelector("#sourceSummary");
const checkSourcesButton = document.querySelector("#checkSourcesButton");
const customSourceForm = document.querySelector("#customSourceForm");
const customSourceName = document.querySelector("#customSourceName");
const customSourceArea = document.querySelector("#customSourceArea");
const customSourceFeed = document.querySelector("#customSourceFeed");
const customSourceSite = document.querySelector("#customSourceSite");
const customSourceLanguage = document.querySelector("#customSourceLanguage");
const customSourceKeywords = document.querySelector("#customSourceKeywords");
const customSourcesList = document.querySelector("#customSourcesList");
const sourceHealthReport = document.querySelector("#sourceHealthReport");
const preferenceForm = document.querySelector("#preferenceForm");
const likedTermsInput = document.querySelector("#likedTerms");
const dislikedTermsInput = document.querySelector("#dislikedTerms");
const preferenceSummary = document.querySelector("#preferenceSummary");
const resetPreferencesButton = document.querySelector("#resetPreferencesButton");

const CUSTOM_SOURCES_KEY = "uutiskooste.customSources.v1";
const PREFERENCES_KEY = "uutiskooste.preferences.v1";
let currentDigest = null;
let knownAreas = [];
let knownSources = [];
let customSources = loadCustomSources();
let preferences = loadPreferences();

init();

async function init() {
  try {
    const response = await fetch("/api/sources", { cache: "no-store" });
    const data = await response.json();
    knownAreas = data.areas;
    knownSources = data.sources;
    const knownAreaIds = new Set(knownAreas.map((area) => area.id));
    const validCustomSources = customSources.filter((source) => knownAreaIds.has(source.area));
    if (validCustomSources.length !== customSources.length) {
      customSources = validCustomSources;
      localStorage.setItem(CUSTOM_SOURCES_KEY, JSON.stringify(customSources));
    }
    renderAreaControls(knownAreas);
    renderCustomAreaOptions(knownAreas);
    renderSourceSummary();
    renderCustomSources();
    renderPreferences();
  } catch (error) {
    metaState.textContent = "Lähdelistan lataus epäonnistui.";
  }
}

function splitPreferenceTerms(value) {
  return Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((term) => term.trim())
        .filter(Boolean)
        .slice(0, 40)
    )
  );
}

function loadPreferences() {
  const empty = { likedTerms: [], dislikedTerms: [], likedTitles: [], dislikedTitles: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}");
    return {
      likedTerms: Array.isArray(parsed.likedTerms) ? parsed.likedTerms.slice(0, 40) : [],
      dislikedTerms: Array.isArray(parsed.dislikedTerms) ? parsed.dislikedTerms.slice(0, 40) : [],
      likedTitles: Array.isArray(parsed.likedTitles) ? parsed.likedTitles.slice(0, 30) : [],
      dislikedTitles: Array.isArray(parsed.dislikedTitles) ? parsed.dislikedTitles.slice(0, 30) : []
    };
  } catch {
    return empty;
  }
}

function savePreferences() {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  renderPreferences();
}

function renderPreferences() {
  likedTermsInput.value = preferences.likedTerms.join(", ");
  dislikedTermsInput.value = preferences.dislikedTerms.join(", ");
  const termCount = preferences.likedTerms.length + preferences.dislikedTerms.length;
  const feedbackCount = preferences.likedTitles.length + preferences.dislikedTitles.length;
  preferenceSummary.textContent =
    termCount || feedbackCount
      ? `Aiheita ${termCount}. Uutispalautteita ${feedbackCount}.`
      : "Ei tallennettuja kiinnostuksenkohteita.";
}

function handlePreferenceSubmit(event) {
  event.preventDefault();
  preferences.likedTerms = splitPreferenceTerms(likedTermsInput.value);
  preferences.dislikedTerms = splitPreferenceTerms(dislikedTermsInput.value);
  savePreferences();
  metaState.textContent = "Kiinnostusprofiili tallennettu. Se vaikuttaa seuraavaan koosteeseen.";
}

function resetPreferences() {
  preferences = { likedTerms: [], dislikedTerms: [], likedTitles: [], dislikedTitles: [] };
  savePreferences();
  metaState.textContent = "Kiinnostusprofiili tyhjennetty.";
}

function renderAreaControls(areas) {
  areaControls.innerHTML = "";
  for (const area of areas) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = area.id;
    input.checked = true;
    label.append(input, document.createTextNode(area.name));
    areaControls.append(label);
  }
}

function renderCustomAreaOptions(areas) {
  customSourceArea.innerHTML = "";
  for (const area of areas) {
    const option = document.createElement("option");
    option.value = area.id;
    option.textContent = area.name;
    customSourceArea.append(option);
  }
}

function renderSourceSummary() {
  const customCount = customSources.length;
  sourceSummary.textContent = `Peruslähteitä ${knownSources.length}. Omia lähteitä ${customCount}.`;
}

function loadCustomSources() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_SOURCES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomSources() {
  localStorage.setItem(CUSTOM_SOURCES_KEY, JSON.stringify(customSources));
  renderSourceSummary();
  renderCustomSources();
}

function renderCustomSources() {
  customSourcesList.innerHTML = "";
  if (!customSources.length) {
    const empty = document.createElement("p");
    empty.className = "panel-note";
    empty.textContent = "Omia lähteitä ei ole lisätty.";
    customSourcesList.append(empty);
    return;
  }

  const list = document.createElement("ul");
  list.className = "custom-source-list";
  for (const [index, source] of customSources.entries()) {
    const area = knownAreas.find((candidate) => candidate.id === source.area)?.name || source.area;
    const item = document.createElement("li");

    const details = document.createElement("div");
    details.className = "custom-source-details";

    const title = document.createElement("strong");
    title.textContent = source.name;
    const meta = document.createElement("span");
    meta.textContent = `${area} · ${source.language === "en" ? "English" : "Suomi"}`;
    const feed = document.createElement("a");
    feed.href = source.feedUrl;
    feed.target = "_blank";
    feed.rel = "noopener noreferrer";
    feed.textContent = source.feedUrl;
    details.append(title, meta, feed);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Poista";
    removeButton.addEventListener("click", () => {
      customSources.splice(index, 1);
      saveCustomSources();
    });

    item.append(details, removeButton);
    list.append(item);
  }
  customSourcesList.append(list);
}

function getOptions() {
  const checkedAreas = [...areaControls.querySelectorAll("input:checked")].map((input) => input.value);
  return new URLSearchParams({
    areas: checkedAreas.join(","),
    max: maxPerArea.value,
    mode: summaryMode.value,
    language: language.value,
    hours: timeLimit.value,
    links: showLinks.checked ? "true" : "false",
    time: showTime.checked ? "true" : "false"
  });
}

function resetAreaSelections() {
  for (const input of areaControls.querySelectorAll("input[type='checkbox']")) {
    input.checked = false;
  }
  metaState.textContent = "Uutisalueiden valinnat nollattu.";
}

async function fetchDigest() {
  const params = getOptions();
  if (!params.get("areas")) {
    metaState.textContent = "Valitse vähintään yksi uutisalue.";
    return;
  }

  setLoading(true);
  try {
    const response = await fetch(`/api/digest?${params.toString()}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customSources, preferences })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Tuntematon virhe");

    currentDigest = data;
    renderDigest(data);
    renderWarnings(data.warnings || []);
    enableExports(true);
    metaState.textContent = `Laadittu ${formatLocalDate(data.generatedAt)}. Lähteitä mukana: ${data.sourceCount}.`;
  } catch (error) {
    metaState.textContent = `Koosteen laatiminen epäonnistui: ${error.message}`;
  } finally {
    setLoading(false);
  }
}

function handleCustomSourceSubmit(event) {
  event.preventDefault();
  const name = customSourceName.value.trim();
  const feedUrl = customSourceFeed.value.trim();

  if (!name || !feedUrl) {
    metaState.textContent = "Anna omalle lähteelle nimi ja RSS-syöte.";
    return;
  }

  customSources.push({
    name,
    area: customSourceArea.value,
    feedUrl,
    site: customSourceSite.value.trim(),
    language: customSourceLanguage.value,
    topicKeywords: customSourceKeywords.value.trim()
  });

  customSourceForm.reset();
  customSourceLanguage.value = "en";
  saveCustomSources();
  metaState.textContent = "Oma lähde lisätty. Se on mukana seuraavassa koosteessa.";
}

async function checkSources() {
  const params = getOptions();
  if (!params.get("areas")) {
    metaState.textContent = "Valitse vähintään yksi uutisalue ennen lähteiden tarkistusta.";
    return;
  }

  setLoading(true);
  checkSourcesButton.disabled = true;
  sourceHealthReport.hidden = true;
  try {
    const response = await fetch(`/api/source-health?${params.toString()}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customSources })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Tuntematon virhe");

    renderSourceHealth(data);
    metaState.textContent = `Lähteet tarkistettu ${formatLocalDate(data.generatedAt)}.`;
  } catch (error) {
    metaState.textContent = `Lähteiden tarkistus epäonnistui: ${error.message}`;
  } finally {
    checkSourcesButton.disabled = false;
    setLoading(false);
  }
}

function renderSourceHealth(data) {
  sourceHealthReport.hidden = false;
  sourceHealthReport.innerHTML = "";

  const heading = document.createElement("h3");
  heading.textContent = "Lähteiden tarkistus";
  sourceHealthReport.append(heading);

  if (data.warnings?.length) {
    const warnings = document.createElement("ul");
    warnings.className = "source-health-warnings";
    for (const warning of data.warnings) {
      const item = document.createElement("li");
      item.textContent = warning;
      warnings.append(item);
    }
    sourceHealthReport.append(warnings);
  }

  const table = document.createElement("table");
  table.className = "source-health-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Lähde</th>
        <th>Tila</th>
        <th>Hyväksytyt</th>
        <th>Löydetyt</th>
        <th>Viimeisin</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const body = table.querySelector("tbody");

  for (const result of data.results) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td></td>
      <td></td>
      <td>${result.acceptableItems}</td>
      <td>${result.foundItems}</td>
      <td>${result.latest ? formatLocalDate(result.latest) : "Ei aikaa"}</td>
    `;
    row.children[0].textContent = result.custom ? `${result.source} (oma)` : result.source;
    row.children[1].textContent = result.status;
    body.append(row);
  }

  sourceHealthReport.append(table);
}

function updateTitleFeedback(item, direction) {
  const targetKey = direction === "like" ? "likedTitles" : "dislikedTitles";
  const oppositeKey = direction === "like" ? "dislikedTitles" : "likedTitles";
  const isActive = preferences[targetKey].includes(item.title);
  preferences[targetKey] = isActive
    ? preferences[targetKey].filter((title) => title !== item.title)
    : [item.title, ...preferences[targetKey].filter((title) => title !== item.title)].slice(0, 30);
  preferences[oppositeKey] = preferences[oppositeKey].filter((title) => title !== item.title);
  savePreferences();
  if (currentDigest) renderDigest(currentDigest);
  metaState.textContent = isActive
    ? "Uutispalaute poistettu."
    : "Uutispalaute tallennettu. Se vaikuttaa seuraavaan koosteeseen.";
}

function createFeedbackControls(item) {
  const controls = document.createElement("div");
  controls.className = "item-feedback";
  controls.setAttribute("aria-label", "Uutispalaute");

  const moreButton = document.createElement("button");
  moreButton.type = "button";
  moreButton.className = "feedback-action";
  moreButton.textContent = "Enemmän tällaisia";
  moreButton.setAttribute("aria-pressed", String(preferences.likedTitles.includes(item.title)));
  moreButton.addEventListener("click", () => updateTitleFeedback(item, "like"));

  const lessButton = document.createElement("button");
  lessButton.type = "button";
  lessButton.className = "feedback-action";
  lessButton.textContent = "Vähemmän tällaisia";
  lessButton.setAttribute("aria-pressed", String(preferences.dislikedTitles.includes(item.title)));
  lessButton.addEventListener("click", () => updateTitleFeedback(item, "dislike"));

  controls.append(moreButton, lessButton);
  return controls;
}

function renderDigest(data) {
  digestElement.innerHTML = "";
  renderSectionJumpPanel(data.sections);

  for (const section of data.sections) {
    const sectionElement = document.createElement("section");
    sectionElement.className = "section";
    sectionElement.id = `section-${section.id}`;
    const heading = document.createElement("h2");
    heading.textContent = section.name;
    sectionElement.append(heading);

    if (!section.items.length) {
      const empty = document.createElement("p");
      empty.className = "no-news";
      empty.textContent = "Hyväksyttäviä uutisia ei löytynyt määritellyistä lähteistä.";
      sectionElement.append(empty);
      digestElement.append(sectionElement);
      continue;
    }

    const list = document.createElement("ol");
    list.className = "news-list";
    for (const item of section.items) {
      const li = document.createElement("li");
      li.className = "news-item";

      const title = document.createElement("div");
      title.className = "item-title";
      if (item.discovery) {
        const badge = document.createElement("span");
        badge.className = "discovery-badge";
        badge.textContent = "Löytö";
        title.append(badge, document.createTextNode(item.title));
      } else {
        title.textContent = item.title;
      }

      const meta = document.createElement("div");
      meta.className = "item-meta";
      meta.textContent = [item.source, data.options.showTime ? item.displayTime : null].filter(Boolean).join(", ");

      const summary = document.createElement("p");
      summary.className = "item-summary";
      summary.textContent = item.summary;

      li.append(title, meta, summary);

      if (data.options.showLinks) {
        const link = document.createElement("a");
        link.className = "item-link";
        link.href = item.link;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = item.link;
        li.append(link);
      }

      li.append(createFeedbackControls(item));

      list.append(li);
    }
    sectionElement.append(list);
    digestElement.append(sectionElement);
  }
}

function renderSectionJumpPanel(sections) {
  sectionJumpPanel.innerHTML = "";
  sectionJumpPanel.hidden = !sections.length;

  const nav = document.createElement("nav");
  nav.className = "section-jump-nav";
  nav.setAttribute("aria-label", "Siirry uutisalueeseen");

  for (const section of sections) {
    const link = document.createElement("a");
    link.className = "section-jump";
    link.href = `#section-${section.id}`;
    link.textContent = section.name;
    nav.append(link);
  }
  sectionJumpPanel.append(nav);
}

function renderWarnings(warnings) {
  warningsElement.hidden = warnings.length === 0;
  warningsElement.innerHTML = "";
  if (!warnings.length) return;

  const heading = document.createElement("h2");
  heading.textContent = "Huomiot ja puutteet";
  const list = document.createElement("ul");
  for (const warning of warnings) {
    const item = document.createElement("li");
    item.textContent = warning;
    list.append(item);
  }
  warningsElement.append(heading, list);
}

function setLoading(isLoading) {
  refreshButton.disabled = isLoading;
  loadingState.hidden = !isLoading;
  if (isLoading) metaState.textContent = "";
}

function enableExports(enabled) {
  copyButton.disabled = !enabled;
  downloadMarkdownButton.disabled = !enabled;
  downloadTextButton.disabled = !enabled;
  downloadHtmlButton.disabled = !enabled;
}

async function copyDigest() {
  if (!currentDigest) return;
  try {
    await writeClipboard(currentDigest.markdown);
    copyButton.textContent = "Kopioitu";
  } catch (error) {
    copyButton.textContent = "Kopiointi estetty";
  }
  setTimeout(() => {
    copyButton.textContent = "Kopioi kooste";
  }, 1600);
}

async function writeClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      // Some embedded browsers deny the async Clipboard API even after a click.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard copy failed");
}

function downloadFile(filename, contents, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function digestHtml() {
  if (!currentDigest) return "";
  const exportedDigest = digestElement.cloneNode(true);
  for (const controls of exportedDigest.querySelectorAll(".item-feedback")) controls.remove();
  return `<!doctype html>
<html lang="${currentDigest.options.language}">
<meta charset="utf-8">
<title>Uutiskooste</title>
<body>
${exportedDigest.innerHTML}
</body>
</html>`;
}

function formatLocalDate(iso) {
  return new Intl.DateTimeFormat("fi-FI", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(iso));
}

refreshButton.addEventListener("click", fetchDigest);
resetAreasButton.addEventListener("click", resetAreaSelections);
checkSourcesButton.addEventListener("click", checkSources);
customSourceForm.addEventListener("submit", handleCustomSourceSubmit);
preferenceForm.addEventListener("submit", handlePreferenceSubmit);
resetPreferencesButton.addEventListener("click", resetPreferences);
copyButton.addEventListener("click", copyDigest);
downloadMarkdownButton.addEventListener("click", () => {
  if (currentDigest) downloadFile("uutiskooste.md", currentDigest.markdown, "text/markdown;charset=utf-8");
});
downloadTextButton.addEventListener("click", () => {
  if (currentDigest) downloadFile("uutiskooste.txt", currentDigest.markdown, "text/plain;charset=utf-8");
});
downloadHtmlButton.addEventListener("click", () => {
  if (currentDigest) downloadFile("uutiskooste.html", digestHtml(), "text/html;charset=utf-8");
});
