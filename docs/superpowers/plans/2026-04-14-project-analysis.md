# Free Code Project Analysis Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reliable mental model of this repository so an engineer can change it without breaking startup, tool execution, or remote features.

**Architecture:** This repository is a Bun-based terminal AI agent built on React + Ink. The binary starts in a lightweight CLI entrypoint, dispatches fast paths early, then hands off to a large initialization layer in `src/main.tsx`, which constructs app state, loads commands and tools, and renders the REPL loop. Most functionality is organized behind registries (`src/commands.ts`, `src/tools.ts`) and service subsystems (`src/services/*`, `src/bridge/*`, `src/tasks/*`).

**Tech Stack:** Bun, TypeScript, React 19, Ink, Commander, Anthropic SDK, MCP, LSP, Vite, Tailwind v4

---

### Task 1: Confirm Build And Runtime Surface

**Files:**
- Inspect: `package.json`
- Inspect: `scripts/build.ts`
- Inspect: `src/entrypoints/cli.tsx`
- Inspect: `tsconfig.json`

- [ ] **Step 1: Read the package manifest to identify runtime and primary scripts**

Run:

```bash
sed -n '1,220p' package.json
```

Expected: `packageManager` is `bun@1.3.11`, the main scripts are `build`, `build:dev`, `build:dev:full`, `compile`, `dev`, `web:dev`, `web:build`, and `web:preview`.

- [ ] **Step 2: Read the build script to understand feature-flag compilation**

Run:

```bash
sed -n '1,260p' scripts/build.ts
```

Expected: the script uses `bun build`, injects compile-time defines like `MACRO.VERSION`, and enables extra functionality through `--feature` and `--feature-set=dev-full`.

- [ ] **Step 3: Read the CLI bootstrap entrypoint**

Run:

```bash
sed -n '1,260p' src/entrypoints/cli.tsx
```

Expected: the file handles fast paths like `--version`, bridge mode, daemon mode, background sessions, and only then imports the heavier startup path.

- [ ] **Step 4: Read compiler settings to understand project constraints**

Run:

```bash
sed -n '1,200p' tsconfig.json
```

Expected: `moduleResolution` is `bundler`, `jsx` is `react-jsx`, path alias `src/*` is enabled, and `strict` is `false`.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-04-14-project-analysis.md
git commit -m "docs: add free-code project analysis plan"
```

### Task 2: Trace The Main Startup Chain

**Files:**
- Inspect: `src/main.tsx`
- Inspect: `src/screens/REPL.tsx`
- Inspect: `src/state/AppStateStore.ts`

- [ ] **Step 1: Read the main initialization hub**

Run:

```bash
sed -n '1,260p' src/main.tsx
```

Expected: this file starts keychain and MDM prefetch work, initializes config and auth state, loads commands/tools/plugins/skills, and prepares the REPL.

- [ ] **Step 2: Read the REPL screen to locate the interaction loop**

Run:

```bash
sed -n '1,260p' src/screens/REPL.tsx
```

Expected: this file connects prompt submission, message rendering, tool execution, tasks, permissions, surveys, bridge state, and remote session state into one UI loop.

- [ ] **Step 3: Read the app-state definition to identify durable runtime state**

Run:

```bash
sed -n '1,260p' src/state/AppStateStore.ts
```

Expected: the state object includes messages, MCP clients, plugin state, task state, remote-control state, permissions, hooks, todos, and prompt suggestion flags.

- [ ] **Step 4: Write a short architecture note for this task**

Record these conclusions in your notes:

```text
1. src/entrypoints/cli.tsx is the thin dispatcher.
2. src/main.tsx is the composition root.
3. src/screens/REPL.tsx is the long-lived session shell.
4. src/state/AppStateStore.ts defines the shared runtime contract.
```

Expected: you can explain where a new feature should be added depending on whether it affects startup, app state, or the interactive session UI.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-04-14-project-analysis.md
git commit -m "docs: capture startup-chain analysis steps"
```

### Task 3: Map Commands And Tools

**Files:**
- Inspect: `src/commands.ts`
- Inspect: `src/tools.ts`
- Inspect: `src/services/tools/toolOrchestration.ts`
- Inspect: `src/Tool.ts`

- [ ] **Step 1: Read the command registry**

Run:

```bash
sed -n '1,260p' src/commands.ts
```

Expected: the file imports slash commands, conditionally enables some with `feature('...')`, and exposes the registry used by the session UI.

- [ ] **Step 2: Read the tool registry**

Run:

```bash
sed -n '1,280p' src/tools.ts
```

Expected: the file defines the base tool set, conditional tools, plan-mode tools, worktree tools, cron tools, and agent-related tools.

- [ ] **Step 3: Read tool orchestration to understand execution semantics**

Run:

```bash
sed -n '1,220p' src/services/tools/toolOrchestration.ts
```

Expected: read-only or concurrency-safe tools are batched in parallel, while stateful or mutating tools run serially.

- [ ] **Step 4: Read the shared tool contract**

Run:

```bash
sed -n '1,240p' src/Tool.ts
```

Expected: the file defines how tool metadata, permissions, schema validation, and execution context are modeled.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-04-14-project-analysis.md
git commit -m "docs: add command and tool mapping steps"
```

### Task 4: Map External Integrations And High-Risk Subsystems

**Files:**
- Inspect: `src/services/api/client.ts`
- Inspect: `src/services/mcp/client.ts`
- Inspect: `src/bridge/bridgeMain.ts`
- Inspect: `src/tasks`
- Inspect: `src/services/analytics`

- [ ] **Step 1: Read the API client**

Run:

```bash
sed -n '1,260p' src/services/api/client.ts
```

Expected: the file builds Anthropic clients, supports API key, OAuth, Bedrock, Foundry, and Vertex paths, and centralizes transport configuration.

- [ ] **Step 2: Inspect the MCP subsystem surface**

Run:

```bash
find src/services/mcp -maxdepth 2 -type f | sort | sed -n '1,120p'
```

Expected: you see config loading, auth, transport, connection management, normalization, and UI-adjacent helpers.

- [ ] **Step 3: Inspect the remote-control bridge surface**

Run:

```bash
find src/bridge -maxdepth 1 -type f | sort | sed -n '1,120p'
```

Expected: bridge mode is its own subsystem with session setup, transport, permissions, UI glue, and recovery helpers.

- [ ] **Step 4: Inspect the task system surface**

Run:

```bash
find src/tasks -maxdepth 2 -type f | sort | sed -n '1,120p'
```

Expected: you see local agent tasks, shell tasks, remote agent tasks, dream tasks, and task typing shared across the app.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-04-14-project-analysis.md
git commit -m "docs: add integration and subsystem analysis steps"
```

### Task 5: Establish Safe Change Strategy For Future Work

**Files:**
- Inspect: `README.md`
- Inspect: `src/commands/*`
- Inspect: `src/tools/*`
- Inspect: `src/services/*`

- [ ] **Step 1: Verify the intended fork behavior from repository docs**

Run:

```bash
sed -n '1,260p' README.md
```

Expected: the repo is a fork of Claude Code with telemetry removed, injected guardrails removed, and many experimental features enabled.

- [ ] **Step 2: Confirm the project currently lacks a normal test layout**

Run:

```bash
find . -maxdepth 2 \( -name 'test' -o -name 'tests' -o -name '__tests__' \) -type d | sort
```

Expected: little or no dedicated test structure appears, so verification for future changes must rely on targeted runtime checks and command-level smoke tests.

- [ ] **Step 3: Build the project once before attempting behavior changes**

Run:

```bash
bun run build
```

Expected: Bun produces `./cli` successfully. If this fails, fix build blockers before changing behavior anywhere else.

- [ ] **Step 4: Capture the recommended change order for future work**

Record these guardrails in your notes:

```text
1. Start from src/entrypoints/cli.tsx only for dispatch changes.
2. Use src/main.tsx for bootstrapping and global initialization changes.
3. Use src/commands.ts and src/tools.ts only to register or gate features.
4. Implement behavior in focused modules under src/commands, src/tools, src/services, or src/bridge.
5. Rebuild after every non-trivial change because compile-time feature flags affect dead-code elimination.
```

Expected: you have a concrete rule set for where to edit and how to validate changes.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-04-14-project-analysis.md
git commit -m "docs: finalize free-code analysis plan"
```
