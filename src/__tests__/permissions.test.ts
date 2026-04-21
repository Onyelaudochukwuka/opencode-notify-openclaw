import { describe, expect, it } from "bun:test"
import { createPermissionTracker } from "../permissions.js"

describe("createPermissionTracker", () => {
  it("stores tracked permissions and increases pendingCount", () => {
    const tracker = createPermissionTracker()

    tracker.trackPermission("session-1", "permission-1")

    expect(tracker.pendingCount()).toBe(1)
  })

  it("resolvePending returns the first pending result and decreases pendingCount", () => {
    const tracker = createPermissionTracker()

    tracker.trackPermission("session-1", "permission-1")

    expect(tracker.resolvePending("once")).toEqual({
      sessionID: "session-1",
      permissionID: "permission-1",
      response: "once",
    })
    expect(tracker.pendingCount()).toBe(0)
  })

  it("resolvePending returns null when nothing is pending", () => {
    const tracker = createPermissionTracker()

    expect(tracker.resolvePending("always")).toBeNull()
  })

  it("awaitReply resolves when resolvePending is called", async () => {
    const tracker = createPermissionTracker()

    tracker.trackPermission("session-1", "permission-1")
    const replyPromise = tracker.awaitReply("session-1", "permission-1", 100)

    const resolved = tracker.resolvePending("once")
    const reply = await replyPromise

    expect(resolved).toEqual({
      sessionID: "session-1",
      permissionID: "permission-1",
      response: "once",
    })
    expect(reply).toEqual(resolved)
  })

  it("awaitReply resolves with null after timeout", async () => {
    const tracker = createPermissionTracker()

    tracker.trackPermission("session-1", "permission-1")
    const replyPromise = tracker.awaitReply("session-1", "permission-1", 50)

    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(await replyPromise).toBeNull()
    expect(tracker.pendingCount()).toBe(0)
  })

  it("resolves pending permissions in FIFO order", () => {
    const tracker = createPermissionTracker()

    tracker.trackPermission("session-1", "permission-1")
    tracker.trackPermission("session-2", "permission-2")

    expect(tracker.resolvePending("always")).toEqual({
      sessionID: "session-1",
      permissionID: "permission-1",
      response: "always",
    })
    expect(tracker.resolvePending("reject")).toEqual({
      sessionID: "session-2",
      permissionID: "permission-2",
      response: "reject",
    })
  })

  it("handles late resolvePending gracefully after timeout", async () => {
    const tracker = createPermissionTracker()

    tracker.trackPermission("session-1", "permission-1")
    const replyPromise = tracker.awaitReply("session-1", "permission-1", 50)

    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(await replyPromise).toBeNull()
    expect(tracker.resolvePending("once")).toBeNull()
  })

  it("clearAll resolves all awaiting promises with null immediately", async () => {
    const tracker = createPermissionTracker()

    tracker.trackPermission("session-1", "permission-1")
    tracker.trackPermission("session-2", "permission-2")

    const replyOne = tracker.awaitReply("session-1", "permission-1", 1_000)
    const replyTwo = tracker.awaitReply("session-2", "permission-2", 1_000)

    tracker.clearAll()

    expect(await replyOne).toBeNull()
    expect(await replyTwo).toBeNull()
    expect(tracker.pendingCount()).toBe(0)
  })

  it("awaitReply returns null when the tracked permission cannot be found", async () => {
    const tracker = createPermissionTracker()

    tracker.trackPermission("session-1", "permission-1")

    expect(await tracker.awaitReply("session-2", "permission-2", 100)).toBeNull()
    expect(tracker.pendingCount()).toBe(1)
  })
})
