# Web Runtime Parity Audit

Date: 2026-04-16
Source plan: [consensus-web-agent-remediation-2026-04-16.md](/Users/kris/项目/Project_demo/evolution/free-code/.omx/plans/consensus-web-agent-remediation-2026-04-16.md)

## Scope

This audit covers the current `src/web` execution path for:

- `bash`
- `read`
- `write`
- `skill`

and compares it to the remediation target described in the consensus plan.

## Key findings

### 1. Web runtime is a separate tool loop, not a CLI-aligned execution model

Current state:

- [src/web/engine/WebQueryEngine.ts](/Users/kris/项目/Project_demo/evolution/free-code/src/web/engine/WebQueryEngine.ts) runs a custom Anthropic tool loop
- tool messages are flattened into a simplified local message history
- there is no typed runtime event contract beyond current ad hoc SSE events

Impact:

- parity drift is structurally likely
- retries, cancellation, and transcript semantics are fragile

### 2. `skill` is special-cased twice

Current state:

- tool path exists in [src/web/engine/tools/WebSkillTool.ts](/Users/kris/项目/Project_demo/evolution/free-code/src/web/engine/tools/WebSkillTool.ts)
- separate direct execution path exists in [src/web/server.ts](/Users/kris/项目/Project_demo/evolution/free-code/src/web/server.ts) `POST /api/sessions/:id/skill`
- [src/web/engine/SessionManager.ts](/Users/kris/项目/Project_demo/evolution/free-code/src/web/engine/SessionManager.ts) also exposes `executeSkill()`

Impact:

- skill execution does not yet have one canonical runtime path
- transcript visibility and runtime observability are inconsistent
- this is a direct parity and stability risk

### 3. Current event model is too thin for release-gate verification

Current state:

- stream events only include:
  - `user`
  - `assistant`
  - `tool_use`
  - `tool_result`
  - `report_plan`
  - `system`
  - `done`
  - `error`

Missing relative to remediation target:

- `tool_start`
- `tool_stream`
- `tool_error`
- `state_update`
- source tagging
- machine-checkable failure classification

Impact:

- the current event flow is not strong enough to support deterministic cutover gates

### 4. Tool-level file safety is weaker than HTTP-level workspace safety

Current state:

- HTTP workspace endpoints in [src/web/server.ts](/Users/kris/项目/Project_demo/evolution/free-code/src/web/server.ts) enforce workspace-relative path checks
- [WebReadFileTool.ts](/Users/kris/项目/Project_demo/evolution/free-code/src/web/engine/tools/WebReadFileTool.ts) and [WebWriteFileTool.ts](/Users/kris/项目/Project_demo/evolution/free-code/src/web/engine/tools/WebWriteFileTool.ts) resolve against `context.cwd` without their own explicit traversal contract

Impact:

- current safety depends on context shaping rather than one explicit unified contract
- this should be normalized in the adapter layer

### 5. Enterprise/admin capability still lacks first-class product surfacing

Current state:

- enterprise/admin flows exist
- much of the experience is still mediated through settings-oriented surfaces instead of a primary IA

Impact:

- even when backend/admin work exists, users cannot clearly see the product model
- visible acceptance criteria remain unmet

## Current parity assessment

| Capability | Current state | Parity confidence | Main gap |
| --- | --- | --- | --- |
| `bash` | callable through web query tool loop | low-medium | no unified event contract or cutover control |
| `read` | callable through web query tool loop | low-medium | same as above, plus file safety normalization gap |
| `write` | callable through web query tool loop | low-medium | same as above, plus explicit persisted-state signaling gap |
| `skill` | callable, but via multiple execution paths | low | duplicated pathways, weak transcript/runtime consistency |

## S1 conclusion

The codebase evidence supports Option B from the consensus plan:

- the main problem is not missing endpoints
- the main problem is execution-path divergence, duplicated semantics, and thin runtime contracts

That means S2 should build a canonical adapter/event layer first rather than continuing local patches to the existing tool loop.

## First harness evidence

Initial `BUILD_STUDIO_20@v1` shadow run evidence evolved across S1:

- first stable run reached step `16` and failed with `VISIBILITY_MISMATCH`
- after adding explicit legacy source tags, a later run failed earlier at step `9` with `MISSING_REQUIRED_EVENT`
- current `source_path` values for working tool and skill steps are now `legacy`

Interpretation:

- the current web stack can already support a surprising amount of the admin/build-studio control path
- the first product-surface failure is exactly where the user said it would be: the frontend still does not expose `Admin Studio` as a first-class surface
- once source tagging was added, the harness exposed a more specific runtime flaw: repeated skill invocation does not always emit the full expected event lifecycle on the second pass
- source tagging is now partially present through `legacy`, but adapter/source split is still not implemented

This confirms that:

- S1 was worth doing as an executable audit, not just a written plan
- S2 must focus on event/source normalization and repeated skill lifecycle consistency before migration proof is possible
- S5 remains blocked on product surfacing, not just backend state availability
