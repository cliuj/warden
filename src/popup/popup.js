const $ = (id) => document.getElementById(id);

function fmt(ms) {
  if (ms < 0) ms = 0;
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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

$("start").addEventListener("click", async () => {
  const h = parseInt($("hours").value, 10) || 0;
  const m = parseInt($("minutes").value, 10) || 0;
  const totalMs = (h * 60 + m) * 60 * 1000;
  if (totalMs < 60 * 1000) return;
  await browser.runtime.sendMessage({ type: "startSession", totalMs });
  refresh();
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

refresh();
refreshBlockButton();
setInterval(refresh, 1000);
