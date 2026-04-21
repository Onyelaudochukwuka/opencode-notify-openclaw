export type PermissionResponse = "once" | "always" | "reject"

export type PendingResult = {
  sessionID: string
  permissionID: string
  response: PermissionResponse
}

type QueueEntry = {
  sessionID: string
  permissionID: string
  resolve: ((result: PendingResult | null) => void) | null
  timer: ReturnType<typeof setTimeout> | null
  settled: boolean
}

export type PermissionTracker = {
  trackPermission: (sessionID: string, permissionID: string) => void
  resolvePending: (response: PermissionResponse) => PendingResult | null
  awaitReply: (sessionID: string, permissionID: string, timeoutMs: number) => Promise<PendingResult | null>
  clearAll: () => void
  pendingCount: () => number
}

export function createPermissionTracker(): PermissionTracker {
  const queue: QueueEntry[] = []

  function removeEntry(entry: QueueEntry): void {
    const index = queue.indexOf(entry)
    if (index !== -1) {
      queue.splice(index, 1)
    }
  }

  function settleEntry(entry: QueueEntry, result: PendingResult | null): PendingResult | null {
    if (entry.settled) {
      return result
    }

    entry.settled = true

    if (entry.timer !== null) {
      clearTimeout(entry.timer)
      entry.timer = null
    }

    removeEntry(entry)
    entry.resolve?.(result)

    return result
  }

  return {
    trackPermission(sessionID, permissionID) {
      queue.push({ sessionID, permissionID, resolve: null, timer: null, settled: false })
    },

    resolvePending(response) {
      const entry = queue[0]
      if (!entry) {
        return null
      }

      return settleEntry(entry, {
        sessionID: entry.sessionID,
        permissionID: entry.permissionID,
        response,
      })
    },

    awaitReply(sessionID, permissionID, timeoutMs) {
      return new Promise<PendingResult | null>((resolve) => {
        const entry = queue.find(
          (candidate) =>
            candidate.sessionID === sessionID &&
            candidate.permissionID === permissionID &&
            candidate.resolve === null &&
            !candidate.settled,
        )

        if (!entry) {
          resolve(null)
          return
        }

        entry.resolve = resolve
        entry.timer = setTimeout(() => {
          settleEntry(entry, null)
        }, timeoutMs)
      })
    },

    clearAll() {
      const entries = [...queue]
      for (const entry of entries) {
        settleEntry(entry, null)
      }
    },

    pendingCount() {
      return queue.length
    },
  }
}
