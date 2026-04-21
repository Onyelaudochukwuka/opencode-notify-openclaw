import { describe, it, expect, mock } from "bun:test"
import { createDebouncer } from "../debounce.js"

describe("createDebouncer", () => {
  it("should fire callback after delayMs on single trigger", async () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.trigger("payload1")
    expect(callback).not.toHaveBeenCalled()

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("payload1")
  })

  it("should fire callback exactly once after 5 rapid triggers within window", async () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.trigger("p1")
    debouncer.trigger("p2")
    debouncer.trigger("p3")
    debouncer.trigger("p4")
    debouncer.trigger("p5")

    expect(callback).not.toHaveBeenCalled()

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("p5")
  })

  it("should reset timer on each trigger: t=0, t=50, t=100 fires at t=100+delay", async () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.trigger("p1")
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(callback).not.toHaveBeenCalled()

    debouncer.trigger("p2")
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(callback).not.toHaveBeenCalled()

    debouncer.trigger("p3")
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("p3")
  })

  it("should respect custom debounceMs: 500ms delay fires 500ms after last trigger", async () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(500, callback)

    debouncer.trigger("data")
    await new Promise((resolve) => setTimeout(resolve, 499))
    expect(callback).not.toHaveBeenCalled()

    await new Promise((resolve) => setTimeout(resolve, 1))
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("data")
  })

  it("should clear pending debounce on cancel() - callback never fires", async () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.trigger("payload")
    await new Promise((resolve) => setTimeout(resolve, 50))
    debouncer.cancel()
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(callback).not.toHaveBeenCalled()
  })

  it("should fire callback synchronously on immediate(payload)", () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.immediate("now")
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("now")
  })

  it("should fire immediately AND clear pending timer on immediate() during active pending timer", async () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.trigger("pending")
    await new Promise((resolve) => setTimeout(resolve, 50))
    debouncer.immediate("now")

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("now")

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(callback).toHaveBeenCalledTimes(1) // no double-fire
  })

  it("should pass most recent payload to callback from rapid burst", async () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.trigger("first")
    debouncer.trigger("second")
    debouncer.trigger("third")

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(callback).toHaveBeenCalledWith("third")
  })

  it("should be idempotent on multiple cancel() calls", async () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.trigger("payload")
    debouncer.cancel()
    debouncer.cancel()
    debouncer.cancel()

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(callback).not.toHaveBeenCalled()
  })

  it("should start fresh debounce after cancel()", async () => {
    const callback = mock(() => {})
    const debouncer = createDebouncer(100, callback)

    debouncer.trigger("first")
    debouncer.cancel()
    debouncer.trigger("second")

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith("second")
  })
})
