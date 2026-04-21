import { afterEach, beforeEach, describe, it, expect, mock, vi } from "bun:test"
import { createDebouncer } from "../debounce.js"

describe("createDebouncer", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("should fire callback after delayMs on single trigger", () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.trigger("payload1")
    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("payload1")
  })

  it("should fire callback exactly once after 5 rapid triggers within window", () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.trigger("p1")
    debouncer.trigger("p2")
    debouncer.trigger("p3")
    debouncer.trigger("p4")
    debouncer.trigger("p5")

    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("p5")
  })

  it("should reset timer on each trigger: t=0, t=50, t=100 fires at t=100+delay", () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.trigger("p1")
    vi.advanceTimersByTime(50)
    expect(callback).not.toHaveBeenCalled()

    debouncer.trigger("p2")
    vi.advanceTimersByTime(50)
    expect(callback).not.toHaveBeenCalled()

    debouncer.trigger("p3")
    vi.advanceTimersByTime(99)
    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("p3")
  })

  it("should respect custom debounceMs: 500ms delay fires 500ms after last trigger", () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(500, callback)

    debouncer.trigger("data")
    vi.advanceTimersByTime(499)
    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("data")
  })

  it("should clear pending debounce on cancel() - callback never fires", () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.trigger("payload")
    vi.advanceTimersByTime(50)
    debouncer.cancel()
    vi.advanceTimersByTime(100)

    expect(callback).not.toHaveBeenCalled()
  })

  it("should fire callback synchronously on immediate(payload)", () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.immediate("now")
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("now")
  })

  it("should fire immediately AND clear pending timer on immediate() during active pending timer", () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.trigger("pending")
    vi.advanceTimersByTime(50)
    debouncer.immediate("now")

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("now")

    vi.advanceTimersByTime(100)
    expect(callback).toHaveBeenCalledTimes(1) // no double-fire
  })

  it("should pass most recent payload to callback from rapid burst", () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.trigger("first")
    debouncer.trigger("second")
    debouncer.trigger("third")

    vi.advanceTimersByTime(100)
    expect(callback).toHaveBeenCalledWith("third")
  })

  it("should be idempotent on multiple cancel() calls", () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.trigger("payload")
    debouncer.cancel()
    debouncer.cancel()
    debouncer.cancel()

    vi.advanceTimersByTime(100)
    expect(callback).not.toHaveBeenCalled()
  })

  it("should start fresh debounce after cancel()", () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.trigger("first")
    debouncer.cancel()
    debouncer.trigger("second")

    vi.advanceTimersByTime(100)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("second")
  })
})
