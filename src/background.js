const WORK_MS = 25 * 60 * 1000;
const BREAK_MS = 5 * 60 * 1000;
const BLOCKED_URL = browser.runtime.getURL("src/blocked/blocked.html");

let _session = null;
let _blocklist = [];
let _blockerRegistered = false;
let _hydrated = hydrate();

async function hydrate() {
  const { session, blocklist } = await browser.storage.local.get(["session", "blocklist"]);
  _blocklist = blocklist || [];
  if (session && session.endsAt > Date.now()) {
    await resumeSession(session);
  } else if (session) {
    await browser.storage.local.remove("session");
    _session = null;
  }
  updateBadge();
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if ("blocklist" in changes) _blocklist = changes.blocklist.newValue || [];
  if ("session" in changes) {
    _session = changes.session.newValue || null;
    if (_session && _session.phase === "work") registerBlocker();
    else unregisterBlocker();
    updateBadge();
  }
});

async function persistSession() {
  if (_session) await browser.storage.local.set({ session: _session });
  else await browser.storage.local.remove("session");
}

async function startSession(totalMs) {
  const now = Date.now();
  const endsAt = now + totalMs;
  _session = {
    startedAt: now,
    endsAt,
    phase: "work",
    phaseEndsAt: Math.min(now + WORK_MS, endsAt),
  };
  await persistSession();
  registerBlocker();
  scheduleAlarms();
  updateBadge();
  notify("Warden", `Session started — ${formatDuration(totalMs)}`);
}

async function resumeSession(s) {
  const now = Date.now();
  const elapsed = now - s.startedAt;
  const cycleMs = WORK_MS + BREAK_MS;
  const cycleOffset = elapsed % cycleMs;
  const inWork = cycleOffset < WORK_MS;
  const phase = inWork ? "work" : "break";
  const phaseStartOffset = inWork ? 0 : WORK_MS;
  const phaseMs = inWork ? WORK_MS : BREAK_MS;
  const phaseStartedAt = s.startedAt + (elapsed - cycleOffset) + phaseStartOffset;
  const phaseEndsAt = Math.min(phaseStartedAt + phaseMs, s.endsAt);

  _session = { startedAt: s.startedAt, endsAt: s.endsAt, phase, phaseEndsAt };
  await persistSession();
  if (phase === "work") registerBlocker();
  scheduleAlarms();
}

function scheduleAlarms() {
  browser.alarms.clear("phase");
  browser.alarms.clear("timebox");
  if (!_session) return;
  browser.alarms.create("phase", { when: _session.phaseEndsAt });
  browser.alarms.create("timebox", { when: _session.endsAt });
}

async function advancePhase() {
  await _hydrated;
  if (!_session) return;
  const now = Date.now();
  if (now >= _session.endsAt) {
    await endSession("Session complete — all sites unblocked");
    return;
  }
  if (_session.phase === "work") {
    _session.phase = "break";
    _session.phaseEndsAt = Math.min(now + BREAK_MS, _session.endsAt);
    unregisterBlocker();
    notify("Break time", `5-minute break — sites unblocked`);
  } else {
    _session.phase = "work";
    _session.phaseEndsAt = Math.min(now + WORK_MS, _session.endsAt);
    registerBlocker();
    notify("Back to work", `25-minute focus session`);
  }
  await persistSession();
  browser.alarms.create("phase", { when: _session.phaseEndsAt });
  updateBadge();
}

async function endSession(msg) {
  _session = null;
  await browser.storage.local.remove("session");
  browser.alarms.clear("phase");
  browser.alarms.clear("timebox");
  unregisterBlocker();
  updateBadge();
  if (msg) notify("Warden", msg);
}

async function resetSession() {
  await endSession("Session reset");
}

browser.alarms.onAlarm.addListener(async (alarm) => {
  await _hydrated;
  if (alarm.name === "timebox") await endSession("Session complete — all sites unblocked");
  else if (alarm.name === "phase") await advancePhase();
  else if (alarm.name === "badge-tick") updateBadge();
});

browser.alarms.create("badge-tick", { periodInMinutes: 1 });

function blockListener(details) {
  if (!_session || _session.phase !== "work") return {};
  try {
    const host = new URL(details.url).hostname;
    if (isBlocked(host)) {
      const q = new URLSearchParams({ from: details.url }).toString();
      return { redirectUrl: `${BLOCKED_URL}?${q}` };
    }
  } catch (_) {}
  return {};
}

function isBlocked(host) {
  const h = host.toLowerCase();
  return _blocklist.some((entry) => h === entry || h.endsWith("." + entry));
}

function registerBlocker() {
  if (_blockerRegistered) return;
  browser.webRequest.onBeforeRequest.addListener(
    blockListener,
    { urls: ["<all_urls>"], types: ["main_frame"] },
    ["blocking"]
  );
  _blockerRegistered = true;
}

function unregisterBlocker() {
  if (!_blockerRegistered) return;
  browser.webRequest.onBeforeRequest.removeListener(blockListener);
  _blockerRegistered = false;
}

function updateBadge() {
  if (!_session) {
    browser.action.setBadgeText({ text: "" });
    return;
  }
  const mins = Math.max(1, Math.ceil((_session.phaseEndsAt - Date.now()) / 60000));
  browser.action.setBadgeText({ text: `${mins}m` });
  browser.action.setBadgeBackgroundColor({
    color: _session.phase === "work" ? "#c0392b" : "#27ae60",
  });
}

function normalizeHost(input) {
  let s = (input || "").trim();
  if (!s) return "";
  if (!/^[a-z]+:\/\//i.test(s)) s = "http://" + s;
  try {
    return new URL(s).hostname.replace(/^www\./, "").toLowerCase();
  } catch (_) {
    return input.trim().toLowerCase().replace(/^www\./, "");
  }
}

async function addToBlocklist(rawHost) {
  const host = normalizeHost(rawHost);
  if (!host) return;
  if (!_blocklist.includes(host)) {
    _blocklist = [..._blocklist, host].sort();
    await browser.storage.local.set({ blocklist: _blocklist });
  }
}

async function removeFromBlocklist(host) {
  _blocklist = _blocklist.filter((h) => h !== host);
  await browser.storage.local.set({ blocklist: _blocklist });
}

browser.runtime.onMessage.addListener(async (msg) => {
  await _hydrated;
  switch (msg?.type) {
    case "getStatus":
      return { session: _session, blocklist: _blocklist };
    case "startSession":
      await startSession(msg.totalMs);
      return { ok: true };
    case "resetSession":
      await resetSession();
      return { ok: true };
    case "addToBlocklist":
      await addToBlocklist(msg.host);
      return { ok: true, blocklist: _blocklist };
    case "removeFromBlocklist":
      await removeFromBlocklist(msg.host);
      return { ok: true, blocklist: _blocklist };
  }
});

browser.runtime.onInstalled.addListener(setupContextMenu);
browser.runtime.onStartup.addListener(setupContextMenu);

function setupContextMenu() {
  browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: "warden-block-site",
      title: "Warden: block this site",
      contexts: ["page", "link"],
    });
  });
}

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "warden-block-site") return;
  const url = info.linkUrl || info.pageUrl || tab?.url;
  const host = normalizeHost(url ? new URL(url).hostname : "");
  if (!host) return;
  await addToBlocklist(host);
  notify("Warden", `Blocked: ${host}`);
});

browser.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== "block-current-site") return;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;
  try {
    const host = normalizeHost(new URL(tab.url).hostname);
    await addToBlocklist(host);
    notify("Warden", `Blocked: ${host}`);
  } catch (_) {}
});

function notify(title, message) {
  browser.notifications.create({
    type: "basic",
    iconUrl: browser.runtime.getURL("icons/icon.svg"),
    title,
    message,
  });
}

function formatDuration(ms) {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
