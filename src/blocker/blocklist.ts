import { normalizeHost } from '../utils'

let blocklist: string[] = []

export function getBlocklist(): string[] {
  return [...blocklist]
}

export function restoreBlocklist(storedBlocklist: string[] | undefined): void {
  blocklist = storedBlocklist ?? []
}

export async function addToBlocklist(rawHost: string): Promise<void> {
  const host = normalizeHost(rawHost)
  if (!host || blocklist.includes(host)) {
    return
  }

  blocklist = [...blocklist, host].sort()

  await browser.storage.local.set({
    blocklist
  })

}

export async function removeFromBlocklist(
  host: string
): Promise<void> {
  blocklist = blocklist.filter(entry => entry !== host)

  await browser.storage.local.set({
    blocklist
  })
}
