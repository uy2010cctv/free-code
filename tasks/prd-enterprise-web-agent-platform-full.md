# PRD: Enterprise Web Agent Platform — Full Implementation

## Introduction

Complete the enterprise web agent platform by:
1. Fixing all known bugs from architect review (type incompatibility, dead code, test assertion mismatches)
2. Executing the Web Agent Remediation plan (S1–S7) to achieve CLI-runtime parity
3. Executing the Enterprise Web Agent Platform plan (Story 1–7) to deliver admin-first enterprise capabilities
4. Achieving a green `BUILD_STUDIO_20@v1` scenario run as the release gate

**Background:** This is a brownfield project extending `src/web` with enterprise agent capabilities. The system can already run basic chat, execute tools, and manage sessions. The goal is to make it production-stable with full admin/user surfaces.

**Reference plans:**
- `.omx/plans/consensus-web-agent-remediation-2026-04-16.md` — 7-stage remediation plan
- `.omx/plans/consensus-enterprise-web-agent-platform-2026-04-16.md` — 7-story enterprise platform plan
- `.omx/artifacts/claude-s3-s4-architect-review-20260416T000000Z.md` — Known bugs to fix

---

## Known Bugs to Fix First

Before any feature work, fix these 5 bugs:

### Bug 1: `Message` type incompatibility
- **Location:** `src/web/types.ts:22-35` vs `src/web/engine/types.ts:39-50`
- **Issue:** `types.ts` defines `Message.type` as required; `engine/types.ts` defines it as optional and lacks `reportPlan`
- **Fix:** Unify both `Message` type definitions. `engine/types.ts` should match `types.ts` and include `reportPlan`

### Bug 2: Dead `withAdminQuery` function
- **Location:** `src/web/AppWeb.tsx:44-46`
- **Issue:** Function exists but returns `path` unchanged, `adminFetch` calls it but it does nothing
- **Fix:** Either remove it or make it do actual admin query path transformation

### Bug 3: `latestReportPlan` state set but never consumed
- **Location:** `src/web/AppWeb.tsx:42`
- **Issue:** `setLatestReportPlan(...)` is called in the `report_plan` handler but the state is never read in JSX
- **Fix:** Either wire it into the UI (ReportInspector component) or remove if truly unnecessary

### Bug 4: Test assertion mismatch
- **Location:** `src/web/engine/__tests__/web-query-engine.test.ts:94-115`
- **Issue:** Test expects `createCalls[2].messages` to have 5 messages, but actual flow produces 6
- **Fix:** Correct the assertion to match actual runtime behavior (6 messages)

### Bug 5: `hasToolUse` potential stale carryover
- **Location:** `src/web/engine/WebQueryEngine.ts:133`
- **Issue:** `hasToolUse` is never explicitly reset to `false` inside the loop
- **Fix:** Add explicit `hasToolUse = false` reset at loop entry or after processing

---

## Goals

1. All 5 known bugs resolved
2. Web runtime achieves CLI parity for `bash`, `read`, `write`, `skill` tools
3. Admin Studio is a first-class product surface (not settings-only)
4. Agent Workspace shows visible output outcomes
5. `BUILD_STUDIO_20@v1` scenario passes in **primary mode** on **3 clean restarts**
6. No `source=legacy` events for migrated tools in primary mode
7. `bun run web:build`, `bun run web:test`, `bun run web:check` all pass

---

## User Stories

### Phase 1: Bug Fixes

### US-B1: Fix Message type incompatibility
**Description:** As a developer, I need the Message type unified between web and engine layers so type errors don't mask real bugs.

**Acceptance Criteria:**
- [ ] `src/web/types.ts` and `src/web/engine/types.ts` have compatible `Message` definitions
- [ ] `reportPlan` field exists in engine types
- [ ] `bun run web:check` passes with no type errors

### US-B2: Remove dead `withAdminQuery` code
**Description:** As a developer, I want dead code removed so the codebase is maintainable.

**Acceptance Criteria:**
- [ ] `withAdminQuery` is either removed or actually does path transformation
- [ ] Code compiles and runs without the unused function

### US-B3: Wire or remove `latestReportPlan`
**Description:** As a user, I want report plan results visible in the UI so I can inspect what was generated.

**Acceptance Criteria:**
- [ ] `latestReportPlan` state is consumed in JSX (e.g., shown in ReportInspector) OR removed if not needed
- [ ] If consumed: report plan visible after generation
- [ ] If removed: `setLatestReportPlan` calls removed from handler

### US-B4: Fix test assertion values
**Description:** As a developer, I need tests that reflect actual runtime behavior so CI catches real regressions.

**Acceptance Criteria:**
- [ ] `web-query-engine.test.ts` assertions match actual code flow
- [ ] `bun run web:test` passes

### US-B5: Fix `hasToolUse` stale state
**Description:** As a user, I want tool use detection reliable so repeated tool invocations work correctly.

**Acceptance Criteria:**
- [ ] `hasToolUse` explicitly reset inside the query loop
- [ ] Repeated skill invocation in same session works correctly

---

### Phase 2: Web Agent Remediation (S1–S7)

#### S1: Runtime parity audit and scenario harness
**Stories:**
- US-S1A: Create CLI vs web parity matrix for `bash/read/write/skill`
- US-S1B: Document failure taxonomy in code
- US-S1C: Verify `BUILD_STUDIO_20@v1` scenario spec is concrete and executable
- US-S1D: Ensure evidence schema for logs/run JSON is stable

#### S2: Runtime adapter and event contract
**Stories:**
- US-S2A: Build web runtime adapter layer
- US-S2B: Implement unified event contract (`tool_start`, `tool_result`, `tool_error`, `done`)
- US-S2C: Add shadow-mode plumbing for dual-path execution
- US-S2D: Tag all executions with `source=legacy` or `source=adapter`

#### S3: Stable `bash/read/write` migration
**Stories:**
- US-S3A: Migrate `bash` tool to adapter path
- US-S3B: Migrate `read` tool to adapter path
- US-S3C: Migrate `write` tool to adapter path
- US-S3D: Verify per-capability cutover criteria met

#### S4: Stable skill migration
**Stories:**
- US-S4A: Move local skill execution onto adapter path
- US-S4B: Make skill lifecycle transcript-visible
- US-S4C: Verify repeated skill invocation works in-session

#### S5: Admin Studio primary IA
**Stories:**
- US-S5A: Add primary nav entry for Admin Studio
- US-S5B: Implement Data Sources management view
- US-S5C: Implement Modules management view
- US-S5D: Implement Publish Center view

#### S6: Agent Workspace visible outcome flow
**Stories:**
- US-S6A: Add primary nav entry for Agent Workspace
- US-S6B: Show published module outcomes in workspace/result surfaces
- US-S6C: Verify publish has visible downstream effect

#### S7: Hardening and release certification
**Stories:**
- US-S7A: Produce final evidence bundle
- US-S7B: Run mixed-path audit
- US-S7C: Confirm 3-restart-clean evidence
- US-S7D: Verify release checklist complete

---

### Phase 3: Enterprise Platform (Story 1–7)

#### Story 1: Normalize enterprise contracts
**Stories:**
- US-E1A: Shared types for connectors, modules, reports, publish state exist in one place
- US-E1B: Module publish state is explicit (`draft | refreshed | published`)
- US-E1C: Session context persists enterprise selections cleanly

#### Story 2: Administrator connector management
**Stories:**
- US-E2A: Connector list API endpoint works
- US-E2B: Connector registration API works
- US-E2C: Admin Studio shows connector listing with metadata
- US-E2D: Session assignment of connectors works

#### Story 3: Administrator module lifecycle
**Stories:**
- US-E3A: Module list and creation API works
- US-E3B: Module refresh API works
- US-E3C: Admin Studio shows module listing with lifecycle states
- US-E3D: Draft and refreshed states are visually distinct

#### Story 4: Publish confirmation gate
**Stories:**
- US-E4A: Module publish requires explicit confirmation in API
- US-E4B: Module publish requires explicit confirmation in UI
- US-E4C: Non-publish generation paths remain automatic

#### Story 5: Report planning and trace metadata
**Stories:**
- US-E5A: Report plan endpoint exists and returns structured plan
- US-E5B: Report plan details visible in transcript/inspector
- US-E5C: Connector and module provenance attached to plans

#### Story 6: Bind admin configuration to user generation
**Stories:**
- US-E6A: Query engine consumes published modules and selected connectors
- US-E6B: User request generates enterprise outputs from configured context
- US-E6C: Generated `docx`, `xlsx` artifacts are downloadable/visible

#### Story 7: Verification hardening
**Stories:**
- US-E7A: `web:build` passes
- US-E7B: `web:test` passes
- US-E7C: API smoke tests cover connector, module, report-plan endpoints
- US-E7D: Browser-path validation for admin and user flows

---

## Functional Requirements

### FR-B1: Type Compatibility
Both `Message` type definitions must be identical in shape. All optional fields must be consistently optional. The `reportPlan` field must be present in engine layer when `type === 'report_plan'`.

### FR-B2: Dead Code Removal
`withAdminQuery` must either perform a meaningful transformation on the admin query path, or be removed entirely along with all its call sites.

### FR-B3: Report Plan Visibility
When a report plan is generated, the resulting `ReportPlan` object must be displayed in the UI within the same session context. Either wire `latestReportPlan` into the component tree or remove all references.

### FR-B4: Test Accuracy
Test expectations must match actual runtime behavior. If the query engine produces 6 messages in `createCalls[2]`, the test asserts 6, not 5.

### FR-B5: Loop State Isolation
`hasToolUse` flag must be reset to `false` at the start of each iteration of the query loop. No stale carryover between iterations.

### FR-R1: Runtime Adapter
Web runtime must have a single canonical execution path for `bash`, `read`, `write`, `skill` that mirrors CLI semantics. Legacy paths must be tagged `source=legacy`, adapter paths tagged `source=adapter`.

### FR-R2: Shadow Mode
During migration, adapter must run in shadow mode observing legacy executions without user-visible regression. Shadow mode evidence must be captured before primary cutover.

### FR-R3: Event Contract
All tool executions must emit: `tool_start`, `tool_result` or `tool_error`, and `done`. Skills additionally emit `tool_start` with skill name and visible lifecycle events.

### FR-R4: Cutover Gate
A migrated capability's legacy path must not be removed until `BUILD_STUDIO_20@v1` passes in primary mode for that capability across 3 clean restarts.

### FR-R5: Admin Studio IA
Admin Studio must be reachable from primary navigation (not buried in settings). It must show Data Sources, Modules, and Publish Center as first-class views.

### FR-R6: Agent Workspace IA
Agent Workspace must be reachable from primary navigation. Published outcomes must be visible in workspace/result surfaces within the same session.

### FR-E1: Enterprise Contracts
Shared types must live in one place (`src/web/engine/types.ts` or `src/web/types.ts`) and be the single source of truth for all web enterprise surfaces.

### FR-E2: Connector Registry API
API must support: list all connectors, register new connector, update connector metadata, assign connector to session. Connector definition must include: `id`, `name`, `kind`, `schemaHints`, `authType`, `status`, `compatibilityStatus`.

### FR-E3: Module Registry API
API must support: list all modules, create module draft, refresh module, publish module with confirmation, list published modules. Module lifecycle states: `draft` → `refreshed` → `published`.

### FR-E4: Report Plan Service
Report plan must be generated from: user intent, selected connectors, published modules. Plan must include: `reportType`, `summary`, `trace`, `exports`, `timestamp`, `source`. Plan must be inspectable in UI.

### FR-E5: Generation Binding
Query engine must receive `connectorSummaries` and `moduleSummaries` in runtime context. User requests matching report patterns (`/report|summary|dashboard|analysis/i`) must trigger report plan flow.

---

## Non-Goals

1. **No ERP/CRM replacement** — V1 is not a full enterprise system replacement
2. **No generic low-code platform** — Module scope is constrained to agent capabilities and report behaviors
3. **No collaborative real-time editing** — Multi-user editing is out of scope
4. **No real-time data sync** — Connectors provide point-in-time schema hints, not live data
5. **No arbitrary screen/page composition** — Module outputs are `docx`/`xlsx`/report artifacts, not UI pages
6. **No V1 governance/audit depth** — Audit trails are deferred beyond V1

---

## Technical Considerations

### Build & Test Commands
```bash
bun run web:build    # Build the web app
bun run web:test     # Run unit tests
bun run web:check    # Typecheck + build + test
```

### Scenario Runner
```bash
bun run scripts/web-build-studio-scenario.ts --suite BUILD_STUDIO_20@v1 --mode shadow
bun run scripts/web-build-studio-scenario.ts --suite BUILD_STUDIO_20@v1 --mode primary --restarts 3
```

### Key Files
- `src/web/AppWeb.tsx` — Main web app component
- `src/web/server.ts` — Express server + API routes
- `src/web/engine/SessionManager.ts` — Session lifecycle
- `src/web/engine/WebQueryEngine.ts` — Query execution engine
- `src/web/engine/types.ts` — Engine type definitions
- `src/web/types.ts` — Web layer type definitions
- `src/web/components/AdminStudio.tsx` — Admin management surface
- `src/web/components/WorkspacePanel.tsx` — Agent workspace surface

### Architecture Constraint
All web enterprise surfaces must depend on the same connector, module, report, and publish-state contracts. No separate shapes invented per component.

---

## Success Metrics

1. `BUILD_STUDIO_20@v1` returns `status=pass` in primary mode
2. No `source=legacy` events for migrated tools in primary mode
3. `bun run web:build` → exit code 0
4. `bun run web:test` → all tests green
5. `bun run web:check` → full pipeline green
6. Admin Studio reachable via primary nav with Data Sources, Modules, Publish Center
7. Agent Workspace reachable via primary nav with visible output outcomes
8. Connector CRUD API smoke tests pass
9. Module lifecycle (draft→refreshed→published) works end-to-end
10. Report plan visible in transcript after generation request

---

## Open Questions

1. Should `hasToolUse` reset logic be at loop entry or after each `tool_use` block? (affects FR-B5)
2. Is there a preferred UX for displaying `latestReportPlan` in the workspace? (affects US-B3)
3. Should shadow mode produce visible UI indicators during migration period? (affects S2)
4. What is the canonical first module archetype for demonstration? (affects Story 3)
5. Does post-V1 governance require stronger confirmation around external write-back? (deferred, noted)
