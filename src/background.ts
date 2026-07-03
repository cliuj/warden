const WORK_MS: number = 25 * 60 * 1000
const BREAK_MS: number = 5 * 60 * 1000
const BLOCKED_URL: string = browser.runtime.getURL('src/blocked/blocked.html')

type Phase = "work" | "break"

type Session = {
  startedAt: number
  endsAt: number
  phase: Phase
  phaseEndsAt: number
}

type StoredState = {
  session?: Session
  blocklist?: string[]
}

let _session: Session | null = null
let _blocklist: string[] = []
let _blockerRegistered: boolean = false
let _hydrate: Promise<void> = hydrate()

async function hydrate(): Promise<void> {
  const stored: StoredState = await browser.storage.local.get(["session", "blocklist"])
  _blocklist = stored.blocklist || [];

  if (stored.session && stored.session.endsAt > Date.now()) {
    await resumeSession(stored.session)
  } else if (stored.session) {
    await browser.storage.local.remove('session')
    _session = null;
  }
  updateBadge()
}

async function persistSession(): Promise<void> {
  if (_session) {
    await browser.storage.local.set({ session: _session })
  } else {
    await browser.storage.local.remove('session')
  }
}

async function resumeSession(session: Session): Promise<void> {
  const now: number = Date.now()
  const elapsed: number = now - session.startedAt
  const cycleMs: number = WORK_MS + BREAK_MS
  const cycleOffset: number = elapsed % cycleMs
  const inWork: boolean = cycleOffset < WORK_MS

  const phase: Phase = inWork ? 'work' : 'break'

  const phaseStartOffset: number = inWork ? 0 : WORK_MS
  const phaseMs: number = inWork ? WORK_MS : BREAK_MS
  const phaseStartedAt: number = session.startedAt + (elapsed - cycleOffset) + phaseStartOffset
  const phaseEndsAt: number = Math.min(phaseStartedAt + phaseMs, session.endsAt)

  _session = {
    startedAt: session.startedAt,
    endsAt: session.endsAt,
    phase,
    phaseEndsAt
  }

  await persistSession()
  if (phase === "work") {
    registerBlocker()
  } else {
    unregisterBlocker()
  }
  scheduleAlarms()
}

function scheduleAlarms() {
  browser.alarms.clear("phase")
  browser.alarms.clear("timebox")
  if (!_session) {
    return
  }
  browser.alarms.create("phase", {
    when: _session?.phaseEndsAt
  })
  browser.alarms.create("timebox", {
    when: _session?.endsAt
  })
}

function blockListener(details: browser.webRequest._OnBeforeRequestDetails): browser.webRequest.BlockingResponse {
  if (!_session || _session.phase !== "work") {
    return {}
  }

  function isBlocked(host: string) {
    const h: string = host.toLowerCase()
    return _blocklist.some((entry) => h === entry || h.endsWith("." + entry))
  }

  try {
    const host: string = new URL(details.url).hostname
    if (isBlocked(host)) {
      const q: string = new URLSearchParams({ from: details.url}).toString()
      return {
        redirectUrl: `${BLOCKED_URL}?${q}`
      }
    }
  } catch (e) {

  }
  return {};
}

function registerBlocker() {
  if (_blockerRegistered) {
    return
  }

  browser.webRequest.onBeforeRequest.addListener(
    blockListener,
    {
      urls: ["<all_urls>"],
      types: ["main_frame"],
    },
    ["blocking"]
  )
  _blockerRegistered = true
}

function unregisterBlocker() {
  if (!_blockerRegistered) {
    return;
  }

  browser.webRequest.onBeforeRequest.removeListener(blockListener);
  _blockerRegistered = false
}

function updateBadge() {
  if (!_session) {
    browser.webRequest.onBeforeRequest.removeListener(blockListener)
    return
  }

  const mins: number = Math.max(1, Math.ceil((_session.phaseEndsAt - Date.now()) / 60000 ));
  browser.action.setBadgeText({text: `${mins}m`})
  browser.action.setBadgeBackgroundColor({
    color: _session.phase === "work" ? "#c0392b" : "#27ae60"
  })
}
