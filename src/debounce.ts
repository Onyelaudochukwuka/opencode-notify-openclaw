export function createDebouncer<T>(_delayMs: number, _callback: (_payload: T) => void) {
  return {
    trigger: (_payload: T) => {},
    immediate: (_payload: T) => {},
    cancel: () => {},
  }
}
