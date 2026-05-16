const areaControls = document.querySelector("#areaControls");
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

let currentDigest = null;
let knownAreas = [];

init();

async function init() {
  try {
    const response = await fetch("/api/sources", { cache: "no-store" });
    const data = await response.json();
    knownAreas = data.areas;
    renderAreaControls(knownAreas);
  } catch (error) {
    metaState.textContent = "Lähdelistan lataus epäonnistui.";
  }
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

async function fetchDigest() {
  const params = getOptions();
  if (!params.get("areas")) {
    metaState.textContent = "Valitse vähintään yksi uutisalue.";
    return;
  }

  setLoading(true);
  try {
    const response = await fetch(`/api/digest?${params.toString()}`);
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
      title.textContent = item.title;

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
  return `<!doctype html>
<html lang="${currentDigest.options.language}">
<meta charset="utf-8">
<title>Uutiskooste</title>
<body>
${digestElement.innerHTML}
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
