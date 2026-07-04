import {
  Session,
  endSession,
  getSession,
  advanceInterval,
  persistSession,
} from './session'

import { notify } from './notifications'

export async function clearAlarms(): Promise<void> {
  browser.alarms.clear("interval")
  browser.alarms.clear("session")
}

export async function createAlarms(session: Session): Promise<void> {
  browser.alarms.create("interval", {
    when: session.interval.endsAt
  })
  browser.alarms.create("session", {
    when: session.endsAt
  })
}

export async function handleAlarm(alarm: browser.alarms.Alarm) {
  switch(alarm.name) {
    case "session":
      await endSession()
      notify("Warden", "Session completed - all sites unblocked")
      break

    case "interval":
      const session: Session | null = getSession()
      if (!session) {
        return
      }
      const nextSession = await advanceInterval(session)

      if (!nextSession) {
        notify("Warden", "Session completed - all sites unblocked")
        return
      }
      await persistSession(nextSession)
      browser.alarms.create("interval", { when: nextSession.interval.endsAt })

      if (nextSession?.interval.mode === 'break') {
        notify("Break time", "5-minute break - sites unblocked")
      } else {
        notify("Back to work", "25-minute focus session")
      }
      break
  }
}
