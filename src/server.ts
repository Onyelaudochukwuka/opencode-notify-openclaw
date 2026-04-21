import { unlinkSync, writeFileSync } from "fs";

export type ReplyServerInstance = {
  port: number;
  stop: () => void;
};

export function createReplyServer(options: {
  portFilePath: string;
  onReply: (text: string) => void;
}): ReplyServerInstance {
  const { portFilePath, onReply } = options;

  const cleanup = (): void => {
    try {
      unlinkSync(portFilePath);
    } catch {
      // Ignore missing or already-removed port files.
    }
  };

  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: async (req: Request): Promise<Response> => {
      const url = new URL(req.url);

      if (url.pathname === "/health") {
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/reply") {
        if (req.method !== "POST") {
          return new Response("Method Not Allowed", { status: 405 });
        }

        let body: unknown;

        try {
          body = await req.json();
        } catch {
          return new Response("Bad Request", { status: 400 });
        }

        if (
          typeof body !== "object" ||
          body === null ||
          typeof (body as Record<string, unknown>).text !== "string"
        ) {
          return new Response("Bad Request", { status: 400 });
        }

        const textValue = (body as Record<string, unknown>).text;
        const text = typeof textValue === "string" ? textValue.trim() : "";

        if (text.length === 0) {
          return new Response("Bad Request", { status: 400 });
        }

        onReply(text);

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  const port = server.port;

  if (port === undefined) {
    cleanup();
    throw new Error("reply server did not expose a port");
  }

  writeFileSync(portFilePath, String(port), "utf8");

  process.on("exit", cleanup);
  process.on("SIGTERM", cleanup);

  return {
    port,
    stop: (): void => {
      server.stop();
      cleanup();
    },
  };
}
