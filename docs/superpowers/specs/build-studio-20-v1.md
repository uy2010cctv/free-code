# BUILD_STUDIO_20@v1

Date: 2026-04-16
Source plan: [consensus-web-agent-remediation-2026-04-16.md](/Users/kris/项目/Project_demo/evolution/free-code/.omx/plans/consensus-web-agent-remediation-2026-04-16.md)

## Purpose

`BUILD_STUDIO_20@v1` is the deterministic scenario artifact for the first web runtime remediation gate.

It exists to prove, in a machine-checkable way, that the web build-studio flow is:

- stable
- restart-safe
- transcript-visible
- no longer leaking back to legacy execution after cutover

## Suite contract

- Suite name: `BUILD_STUDIO_20@v1`
- Modes:
  - `shadow`
  - `primary`
- Per-step timeout: `15s`
- Full suite timeout: `180s`

## Required result contract

Each run must emit JSON with:

- `suite`
- `mode`
- `status`
- `failure_code`
- `steps`
- `restart_count`
- `log_dir`

## Failure code taxonomy

- `CRASH_PROCESS_EXIT`
- `HANG_TIMEOUT`
- `BLANK_RESULT`
- `MISSING_REQUIRED_EVENT`
- `STATE_CORRUPTION`
- `STALE_STATE_AFTER_RESTART`
- `MIXED_PATH_LEAK`
- `VISIBILITY_MISMATCH`

## Step list

1. get anonymous auth status
2. setup or login admin
3. create session
4. run `bash pwd`
5. run `read README.md`
6. run `write` to workspace scratch file
7. run `bash cat` on the scratch file
8. invoke a known local skill
9. invoke the same skill again in the same session
10. create connector via admin flow
11. list connectors and confirm visibility
12. create module draft
13. refresh module
14. publish module with confirm
15. fetch modules and confirm published state
16. open Admin Studio Modules view and confirm visibility
17. send agent prompt that references published module and data source
18. receive runtime events and non-empty visible outcome
19. restart server and login again
20. re-fetch connectors/modules and confirm persisted state + visible frontend outcome

## Current S1 note

In S1, this suite is intentionally used as an audit harness as well as a release gate definition.

That means:

- some steps may currently fail
- failure is expected evidence, not necessarily a regression
- the first success criterion for S1 is that the suite contract is fixed and executable

## Verification command

```bash
bun run scripts/web-build-studio-scenario.ts --suite BUILD_STUDIO_20@v1 --mode shadow
```
