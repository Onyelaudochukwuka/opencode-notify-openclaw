import { afterEach, describe, expect, it, mock } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createReplyServer } from "../server.js";

type ReplyServerInstance = ReturnType<typeof createReplyServer>;

const tempPaths: string[] = [];
const activeServers: ReplyServerInstance[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "reply-server-test-"));
  tempPaths.push(dir);
  return dir;
}

function startServer(onReply: (text: string) => void = mock()): {
  server: ReplyServerInstance;
  portFilePath: string;
  onReply: (text: string) => void;
} {
  const dir = createTempDir();
  const portFilePath = join(dir, "reply-server.port");
  const server = createReplyServer({ portFilePath, onReply });

  activeServers.push(server);

  return { server, portFilePath, onReply };
}

async function postReply(port: number, body: unknown): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  while (activeServers.length > 0) {
    const server = activeServers.pop();
    server?.stop();
  }

  while (tempPaths.length > 0) {
    const path = tempPaths.pop();
    if (path) {
      rmSync(path, { recursive: true, force: true });
    }
  }
});

describe("createReplyServer", () => {
  it("starts and returns a valid port number", () => {
    const { server } = startServer();

    expect(server.port).toEqual(expect.any(Number));
    expect(server.port).toBeGreaterThan(0);
  });

  it("accepts POST /reply and dispatches reply text", async () => {
    const onReply = mock();
    const { server } = startServer(onReply);

    const response = await postReply(server.port, { text: "hello" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(onReply).toHaveBeenCalledTimes(1);
    expect(onReply).toHaveBeenCalledWith("hello");
  });

  it("returns 400 for an empty request body", async () => {
    const { server } = startServer();

    const response = await fetch(`http://127.0.0.1:${server.port}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 when text is an empty string", async () => {
    const onReply = mock();
    const { server } = startServer(onReply);

    const response = await postReply(server.port, { text: "" });

    expect(response.status).toBe(400);
    expect(onReply).not.toHaveBeenCalled();
  });

  it("returns 405 for GET /reply", async () => {
    const { server } = startServer();

    const response = await fetch(`http://127.0.0.1:${server.port}/reply`);

    expect(response.status).toBe(405);
  });

  it("returns 404 for unknown routes", async () => {
    const { server } = startServer();

    const response = await fetch(`http://127.0.0.1:${server.port}/other-path`, {
      method: "POST",
    });

    expect(response.status).toBe(404);
  });

  it("returns healthy status for GET /health", async () => {
    const { server } = startServer();

    const response = await fetch(`http://127.0.0.1:${server.port}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("writes the selected port to the port file", () => {
    const { server, portFilePath } = startServer();

    expect(existsSync(portFilePath)).toBe(true);
    expect(readFileSync(portFilePath, "utf8")).toBe(String(server.port));
  });

  it("stop() stops the server and deletes the port file", async () => {
    const { server, portFilePath } = startServer();

    expect(existsSync(portFilePath)).toBe(true);

    server.stop();
    activeServers.pop();

    expect(existsSync(portFilePath)).toBe(false);
    expect(fetch(`http://127.0.0.1:${server.port}/health`)).rejects.toThrow();
  });

  it("trims reply text before dispatching to the callback", async () => {
    const onReply = mock();
    const { server } = startServer(onReply);

    const response = await postReply(server.port, { text: "  hello  " });

    expect(response.status).toBe(200);
    expect(onReply).toHaveBeenCalledWith("hello");
  });

  it("returns 400 when text is not a string", async () => {
    const onReply = mock();
    const { server } = startServer(onReply);

    const response = await postReply(server.port, { text: 123 });

    expect(response.status).toBe(400);
    expect(onReply).not.toHaveBeenCalled();
  });

  it("binds to 127.0.0.1 only in the implementation source", () => {
    const source = readFileSync(new URL("../server.ts", import.meta.url), "utf8");

    expect(source).toContain('hostname: "127.0.0.1"');
    expect(source).not.toContain("0.0.0.0");
  });
});
