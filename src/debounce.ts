export type Debouncer<T> = {
  trigger(payload: T): void
  immediate(payload: T): void
  cancel(): void
}

export function createDebouncer<T>(
  delayMs: number,
  callback: (payload: T) => void,
): Debouncer<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let latestPayload: T | undefined

  return {
    trigger(payload: T): void {
      latestPayload = payload
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        callback(latestPayload as T)
      }, delayMs)
    },
    immediate(payload: T): void {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      callback(payload)
    },
    cancel(): void {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}
