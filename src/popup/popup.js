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

refresh();
setInterval(refresh, 1000);
