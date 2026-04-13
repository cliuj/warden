const $ = (id) => document.getElementById(id);
const DEFAULT_PRESETS = [60, 120, 240];

function fmt(ms) {
  if (ms < 0) ms = 0;
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

async function getPresets() {
  const { presets } = await browser.storage.local.get("presets");
  if (!Array.isArray(presets)) {
    await browser.storage.local.set({ presets: DEFAULT_PRESETS });
    return [...DEFAULT_PRESETS];
  }
  return presets;
}

async function setPresets(list) {
  const sorted = [...new Set(list)].filter((n) => n > 0).sort((a, b) => a - b);
  await browser.storage.local.set({ presets: sorted });
  return sorted;
}

async function refresh() {
  const { session } = await browser.runtime.sendMessage({ type: "getStatus" });
  if (!session) {
    $("idle").hidden = false;
    $("running").hidden = true;
    return;
  }
  $("idle").hidden = true;
  $("running").hidden = false;
  const phaseEl = $("phase");
  phaseEl.textContent = session.phase === "work" ? "Focus" : "Break";
  phaseEl.className = `phase ${session.phase}`;
  $("phase-countdown").textContent = fmt(session.phaseEndsAt - Date.now());
  $("total-countdown").textContent = fmt(session.endsAt - Date.now());
}

async function renderPresets() {
  const list = $("preset-list");
  const presets = await getPresets();
  list.innerHTML = "";
  if (!presets.length) {
    const empty = document.createElement("span");
    empty.className = "empty";
    empty.textContent = "No presets — use + to save one.";
    list.appendChild(empty);
    return;
  }
  for (const min of presets) {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = fmtMinutes(min);
    chip.title = `Start a ${fmtMinutes(min)} session`;
    chip.addEventListener("click", async () => {
      await browser.runtime.sendMessage({ type: "startSession", totalMs: min * 60 * 1000 });
      refresh();
    });
    list.appendChild(chip);
  }
}

$("start").addEventListener("click", async () => {
  const h = parseInt($("hours").value, 10) || 0;
  const m = parseInt($("minutes").value, 10) || 0;
  const totalMs = (h * 60 + m) * 60 * 1000;
  if (totalMs < 60 * 1000) return;
  await browser.runtime.sendMessage({ type: "startSession", totalMs });
  refresh();
});

$("save-preset").addEventListener("click", async () => {
  const h = parseInt($("hours").value, 10) || 0;
  const m = parseInt($("minutes").value, 10) || 0;
  const total = h * 60 + m;
  if (total < 1) return;
  const presets = await getPresets();
  if (!presets.includes(total)) await setPresets([...presets, total]);
  renderPresets();
});

$("reset").addEventListener("click", async () => {
  await browser.runtime.sendMessage({ type: "resetSession" });
  refresh();
});

$("open-options").addEventListener("click", (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});

async function currentTabHost() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return null;
  try {
    const u = new URL(tab.url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function refreshBlockButton() {
  const btn = $("block-current");
  const host = await currentTabHost();
  if (!host) {
    btn.disabled = true;
    btn.textContent = "Block current site";
    return;
  }
  const { blocklist } = await browser.runtime.sendMessage({ type: "getStatus" });
  const already = (blocklist || []).includes(host);
  btn.disabled = already;
  btn.textContent = already ? `Already blocking ${host}` : `Block ${host}`;
}

$("block-current").addEventListener("click", async () => {
  const host = await currentTabHost();
  if (!host) return;
  await browser.runtime.sendMessage({ type: "addToBlocklist", host });
  const status = $("block-status");
  status.textContent = `Added ${host} to blocklist`;
  setTimeout(() => (status.textContent = ""), 2000);
  refreshBlockButton();
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.presets) renderPresets();
});

refresh();
renderPresets();
refreshBlockButton();
setInterval(refresh, 1000);
