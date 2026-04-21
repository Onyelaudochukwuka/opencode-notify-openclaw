export function createSender(_config: unknown): { send: (_msg: string) => Promise<void> } {
  return { send: async () => {} }
}
