# Contributing to opencode-notify-openclaw

Thanks for wanting to contribute! Every bug report, feature idea, and pull request makes this project better. Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before getting started.

## Getting Started

Fork the repo through the GitHub UI, then:

```bash
git clone https://github.com/YOUR_USERNAME/opencode-notify-openclaw.git
cd opencode-notify-openclaw
bun install
```

## Development Workflow

Three commands you'll run constantly:

```bash
bun test                # Run all 80 tests across 6 test files
bun run typecheck       # TypeScript strict mode check (tsc --noEmit)
bun run build           # Bundle to dist/index.js
```

All three must pass before you submit a PR. No exceptions.

## Project Structure

Quick map of what lives where in `src/`:

| File | Purpose |
|------|---------|
| `types.ts` | Shared TypeScript types and constants |
| `config.ts` | Config loader, validates plugin options from `opencode.json` |
| `cli.ts` | Openclaw CLI wrapper, timeout, shell-safe escaping, concurrency guard |
| `format.ts` | Message formatters for each event type |
| `debounce.ts` | Debounce manager for `session.idle` events |
| `filter.ts` | Aggressive question/pause detection filter for chat messages |
| `index.ts` | Plugin entry point, wires all hooks together |

Each `src/{module}.ts` has a corresponding `src/__tests__/{module}.test.ts`.

## Making Changes

**Branch naming:**

- `feat/short-description`
- `fix/short-description`
- `docs/short-description`

**Commit style (conventional commits):**

```
feat(scope): add new channel support
fix(cli): handle timeout edge case
docs: update installation steps
chore(package): update dependencies
test(filter): add edge case for empty messages
```

Keep one logical change per commit. If your diff does two unrelated things, split it into two commits.

## Submitting a Pull Request

1. Push your branch to your fork
2. Open a PR against `master` at [onyelaudochukwuka/opencode-notify-openclaw](https://github.com/onyelaudochukwuka/opencode-notify-openclaw)
3. Fill in the PR template: what changed, why, and how you tested it
4. Make sure these all pass locally before opening the PR:
   ```bash
   bun test && bun run typecheck && bun run build
   ```
5. PRs that modify `src/` must include or update corresponding tests

## Reporting Issues

Found a bug or have an idea? Open an issue at [GitHub Issues](https://github.com/onyelaudochukwuka/opencode-notify-openclaw/issues).

- Use the **Bug Report** template for bugs
- Use the **Feature Request** template for ideas

Include reproduction steps when reporting bugs. The more detail, the faster the fix.
