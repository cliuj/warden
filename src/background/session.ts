export const FOCUS_INTERVAL_MS: number = 25 * 60 * 1000
export const BREAK_INTERVAL_MS: number = 5 * 60 * 1000

export type IntervalMode = "focus" | "break"

// Overall timebox
export type Session = {
  startedAt: number
  endsAt: number
  interval: Interval
}

// How long each pomodoro interval should last (focus or break)
export type Interval = {
  mode: IntervalMode
  startedAt: number
  endsAt: number
}

let session: Session | null = null;

export async function clearSession(): Promise<void> {
  session = null
  await browser.storage.local.remove('session')
}

export function getSession(): Session | null {
  return session;
}

export function restoreSession(
  storedSession: Session | undefined,
): void {
  session = storedSession ?? null
}

// Resumes a stored session. The interval is recalculated based
// on the stored session.
export async function resumeSession(storedSession: Session): Promise<Session> {
  const now: number = Date.now()
  const elapsed: number = now - storedSession.startedAt
  const cycleDuration = FOCUS_INTERVAL_MS + BREAK_INTERVAL_MS
  const elapsedInCurrentCycle = elapsed % cycleDuration

  const intervalMode: IntervalMode = elapsedInCurrentCycle < FOCUS_INTERVAL_MS ? 'focus' : 'break'

  const inFocusMode = intervalMode === 'focus'
  const intervalStartOffset: number = inFocusMode ? 0 : FOCUS_INTERVAL_MS
  const intervalDuration: number = inFocusMode ? FOCUS_INTERVAL_MS : BREAK_INTERVAL_MS
  const intervalStartedAt: number = storedSession.startedAt + (elapsed - elapsedInCurrentCycle) + intervalStartOffset
  const intervalEndsAt: number = Math.min(intervalStartedAt + intervalDuration, storedSession.endsAt)

  const resumedSession = {
    startedAt: storedSession.startedAt,
    endsAt: storedSession.endsAt,
    interval: {
      startedAt: intervalStartedAt,
      endsAt: intervalEndsAt,
      mode: intervalMode
    }
  }

  return resumedSession
}

export async function persistSession(next: Session): Promise<void> {
  session = next
  await browser.storage.local.set({
    session: next
  })
}

export async function endSession(): Promise<void> {
  await clearSession()
  await Promise.all([
    browser.alarms.clear("session"),
    browser.alarms.clear("interval")
  ])
}

export async function advanceInterval(session: Session): Promise<Session | null> {
  const now: number = Date.now()

  if (now >= session.endsAt) {
    await endSession()
    return null
  }

  const nextMode = session.interval.mode === 'focus' ? 'break' : 'focus'
  const intervalDuration = nextMode === 'focus' ? FOCUS_INTERVAL_MS : BREAK_INTERVAL_MS
  const nextStartedAt = Date.now()
  const nextEndsAt = Math.min(nextStartedAt + intervalDuration, session.endsAt)

  const nextInterval: Interval = {
      mode: nextMode,
      startedAt: Date.now(),
      endsAt: nextEndsAt,
    }

  const nextSession: Session = {
    ...session,
    interval: nextInterval,
  }

  return nextSession
}

export async function startSession(sessionDuration: number): Promise<Session> {
  const startedAt = Date.now()
  const endsAt = startedAt + sessionDuration
  const newSession: Session = {
    startedAt,
    endsAt,
    interval: {
      endsAt: Math.min(startedAt + FOCUS_INTERVAL_MS, endsAt),
      mode: 'focus',
      startedAt,
    }
  }
  return newSession
}
