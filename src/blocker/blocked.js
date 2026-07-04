const params = new URLSearchParams(location.search);
const from = params.get("from");

const siteEl = document.getElementById("site");
const statusEl = document.getElementById("status");
const countEl = document.getElementById("count");

if (from) {
  try {
    siteEl.textContent = new URL(from).hostname;
  } catch (_) {
    siteEl.textContent = from;
  }
}

function fmt(ms) {
  if (ms < 0) ms = 0;
  const t = Math.ceil(ms / 1000);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function tick() {
  const { session } = await browser.runtime.sendMessage({ type: "getStatus" });
  if (!session) {
    statusEl.textContent = "Session ended — you can reload.";
    countEl.textContent = "";
    return;
  }
  if (session.phase === "break") {
    statusEl.textContent = "On break — reload to access this site.";
    countEl.textContent = fmt(session.phaseEndsAt - Date.now());
    return;
  }
  statusEl.textContent = "Focus time. Next break in";
  countEl.textContent = fmt(session.phaseEndsAt - Date.now());
}

tick();
setInterval(tick, 1000);
