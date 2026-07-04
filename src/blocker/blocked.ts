import {
  getBlocklist
} from './blocklist'

const BLOCKED_URL = browser.runtime.getURL("src/blocker/blocked.html");

export function unregisterBlocker(): void {
  browser.webRequest.onBeforeRequest.removeListener(blockListener)
}

export function registerBlocker(): void {
  if (browser.webRequest.onBeforeRequest.hasListener(blockListener)) {
    return
  }

  browser.webRequest.onBeforeRequest.addListener(
    blockListener,
    {
      urls: ["<all_urls>"],
      types: ["main_frame"],
    },
    ["blocking"],
  )
}

function blockListener(
  details: browser.webRequest._OnBeforeRequestDetails,
): browser.webRequest.BlockingResponse {

  const blocklist = getBlocklist()

  function isBlocked(host: string): boolean {
    const _host: string = host.toLowerCase()
    return blocklist.some((entry) => _host === entry || _host.endsWith("." + entry))
  }

  try {
    const host : string = new URL(details.url).hostname
    if (isBlocked(host)) {
      const query: string = new URLSearchParams({from: details.url}).toString()
      return {
        redirectUrl: `${BLOCKED_URL}?${query}`
      }
    }
  } catch (e) {

  }

  return {}
}
