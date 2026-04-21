// Module-level keyword map (compiled once)
const PERMISSION_KEYWORDS: Map<string, "once" | "always" | "reject"> = new Map([
  ["yes", "once"],
  ["y", "once"],
  ["allow", "once"],
  ["always", "always"],
  ["no", "reject"],
  ["n", "reject"],
  ["deny", "reject"],
  ["reject", "reject"],
]);

export type ParsedReply =
  | { type: "permission"; response: "once" | "always" | "reject" }
  | { type: "freetext"; text: string }
  | null;

export function parseReply(text: string): ParsedReply {
  const trimmed = text.trim();
  if (trimmed === "") return null;

  const lower = trimmed.toLowerCase();
  const permResponse = PERMISSION_KEYWORDS.get(lower);
  if (permResponse !== undefined) {
    return { type: "permission", response: permResponse };
  }

  return { type: "freetext", text: trimmed };
}
