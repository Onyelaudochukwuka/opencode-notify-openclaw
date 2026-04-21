# Validation Spike — Two-Way Bridge Core Assumptions

## Check 1: Bun.serve availability
Status: CONFIRMED
Evidence:
```text
ok
SERVE_OK
```

## Check 2: output.status mutation in permission.ask
Status: CONFIRMED
Evidence: `"permission.ask"?: (input: Permission, output: { status: "ask" | "deny" | "allow" }) => Promise<void>;`
Hook signature: `"permission.ask"?: (input: Permission, output: { status: "ask" | "deny" | "allow" }) => Promise<void>;`

## Check 3: session.list() → time.updated
Status: CONFIRMED
Evidence: `Session.time.updated`
Field path: `Session.time.updated` from `export type Session = { ... time: { created: number; updated: number; compacting?: number; }; ... }`

## Check 4: session.promptAsync() signature
Status: CONFIRMED
Evidence: `promptAsync<ThrowOnError extends boolean = false>(options: Options<SessionPromptAsyncData, ThrowOnError>): import("./client/types.gen.js").RequestResult<SessionPromptAsyncResponses, SessionPromptAsyncErrors, ThrowOnError, "fields">;`
Method name: `promptAsync`
Parameter types: `options: Options<SessionPromptAsyncData, ThrowOnError>` where `SessionPromptAsyncData = { body?: { messageID?: string; model?: { providerID: string; modelID: string; }; agent?: string; noReply?: boolean; system?: string; tools?: { [key: string]: boolean; }; parts: Array<TextPartInput | FilePartInput | AgentPartInput | SubtaskPartInput>; }; path: { id: string; }; query?: { directory?: string; }; url: "/session/{id}/prompt_async"; }`
Return type: `RequestResult<SessionPromptAsyncResponses, SessionPromptAsyncErrors, ThrowOnError, "fields">`
Non-blocking: yes — the SDK comment says `Create and send a new message to a session, start if needed and return immediately`, and `SessionPromptAsyncResponses` is `204: void`, so acceptance happens without waiting for the session response.

## Check 5: postSessionIdPermissionsPermissionId body type
Status: CONFIRMED
Evidence: `PostSessionIdPermissionsPermissionIdData = { body?: { response: "once" | "always" | "reject"; }; ... }`
Method signature: `postSessionIdPermissionsPermissionId<ThrowOnError extends boolean = false>(options: Options<PostSessionIdPermissionsPermissionIdData, ThrowOnError>): import("./client/types.gen.js").RequestResult<PostSessionIdPermissionsPermissionIdResponses, PostSessionIdPermissionsPermissionIdErrors, ThrowOnError, "fields">;`

## Summary
All checks: CONFIRMED
No alternative approach required.
