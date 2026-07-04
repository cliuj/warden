import {
  Session,
  clearSession,
  resumeSession,
  persistSession,
  startSession,
  getSession,
  endSession,
  restoreSession
} from './background/session'

import { normalizeHost } from './utils'

import { registerBlocker, unregisterBlocker } from './blocker/blocked'
import { getBlocklist, addToBlocklist, removeFromBlocklist, restoreBlocklist } from './blocker/blocklist'
import { handleAlarm, createAlarms, clearAlarms } from './background/alarm'
import { notify } from './background/notifications'

const initialized = init()

type StoredState = {
  session: Session,
  blocklist: string[]
}
type Message =
  | { type: "getStatus" }
  | { type: "startSession"; totalDuration: number }
  | { type: "resetSession" }
  | { type: "addToBlocklist"; host: string }
  | { type: "removeFromBlocklist"; host: string }


browser.alarms.onAlarm.addListener(async alarm => {
  await initialized
  await handleAlarm(alarm)
})
browser.alarms.create("badge-tick", { periodInMinutes: 1 });

browser.runtime.onStartup.addListener(setupContextMenu)
browser.runtime.onInstalled.addListener(setupContextMenu)
browser.runtime.onMessage.addListener(async message => {
  await initialized
  return handleMessage(message)
})
browser.storage.onChanged.addListener(handleStorageChange)
browser.commands.onCommand.addListener(handleCommand)
browser.contextMenus.onClicked.addListener(handleContextMenuOnClick)

async function handleContextMenuOnClick(
  info: browser.contextMenus.OnClickData,
  tab?: browser.tabs.Tab
): Promise<void> {
  await initialized
  if (info.menuItemId !== 'warden-block-site') {
    return
  }

  const url = info.linkUrl || info.pageUrl || tab?.url;
  const host = normalizeHost(url ? new URL(url).hostname : "")
  if (!host) {
    return
  }
  await addToBlocklist(host)
  notify("Warden", `Blocked: ${host}`)
}

async function handleCommand(command: string): Promise<void> {
  await initialized
  if (command !== "block-current-site") {
    return
  }

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true})
  if (!tab.url) {
    return
  }

  try {
    const host = normalizeHost(new URL(tab.url).hostname)
    await addToBlocklist(host)
    notify("Warden", `Blocked ${host}`)
  } catch (e) {

  }
}

function handleStorageChange(changes: Record<string, browser.storage.StorageChange>, area: string): void {
  if (area !== "local") {
    return
  }

  if (changes.blocklist) {
    restoreBlocklist(
      changes.blocklist.newValue as string[] | undefined
    )
  }

  if (changes.session) {
    const storedSession = changes.session.newValue as Session | undefined
    restoreSession(storedSession)
    if (storedSession?.interval.mode === 'focus') {
      registerBlocker()
    } else {
      unregisterBlocker()
    }

    // updateBadge
  }
}



async function handleMessage(message: Message) {
  switch(message.type) {
    case "getStatus":
      return {
        session: getSession(),
        blocklist: getBlocklist(),
      }

    case "startSession":
      const session = await startSession(message.totalDuration)
      await persistSession(session)
      registerBlocker()
      createAlarms(session)
      //updateBadge()
      notify("Warden", `Session started - ${formatDuration(message.totalDuration)}`)
      return { ok: true }

    case "resetSession":
      await endSession()
      notify("Warden", "Session reset")
      return { ok: true }

    case "addToBlocklist":
      await addToBlocklist(message.host)
      return { ok: true, blocklist: getBlocklist() }

    case "removeFromBlocklist":
      await removeFromBlocklist(message.host)
      return { ok: true, blocklist: getBlocklist() }
  }
}

function setupContextMenu(): void {
  browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: "warden-block-site",
      title: "Warden: block this site",
      contexts: ["page", "link"]
    })
  })
}

async function init(): Promise<void>{
  const stored: StoredState = await browser.storage.local.get(["session", "blocklist"]) as StoredState
  restoreBlocklist(stored.blocklist)

  // Resume a stored session if one exists (and hasn't been finished)
  if (stored.session && stored.session.endsAt > Date.now()) {
    const session = await resumeSession(stored.session)
    await persistSession(session)
    const mode = session.interval.mode
    if (mode === 'focus') {
      registerBlocker()
    } else {
      unregisterBlocker()
    }
    await clearAlarms()
    await createAlarms(session)
  } else if (stored.session) {
    await clearSession()
  } 
}


function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
