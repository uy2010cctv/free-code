export const BUILD_STUDIO_20_SUITE = 'BUILD_STUDIO_20@v1'

export const FAILURE_CODES = [
  'CRASH_PROCESS_EXIT',
  'HANG_TIMEOUT',
  'BLANK_RESULT',
  'MISSING_REQUIRED_EVENT',
  'STATE_CORRUPTION',
  'STALE_STATE_AFTER_RESTART',
  'MIXED_PATH_LEAK',
  'VISIBILITY_MISMATCH',
] as const

export type FailureCode = typeof FAILURE_CODES[number]
export type ScenarioMode = 'shadow' | 'primary'
export type ScenarioStatus = 'pass' | 'fail'
export type StepStatus = 'pass' | 'fail'

export interface ScenarioStepDefinition {
  id: number
  name: string
  timeoutMs: number
  requiredEventTypes: string[]
  stateAssertions: string[]
  visibleAssertions: string[]
}

export interface ScenarioStepResult {
  step_id: number
  name: string
  status: StepStatus
  expected_event_count: number
  actual_event_count: number
  timeout_ms: number
  source_path: string[]
  state_assertions: string[]
  visible_assertions: string[]
  details?: string
}

export interface ScenarioRunResult {
  suite: typeof BUILD_STUDIO_20_SUITE
  mode: ScenarioMode
  status: ScenarioStatus
  failure_code: FailureCode | null
  steps: ScenarioStepResult[]
  restart_count: number
  log_dir: string
}

export const BUILD_STUDIO_20_STEPS: ScenarioStepDefinition[] = [
  {
    id: 1,
    name: 'get anonymous auth status',
    timeoutMs: 15_000,
    requiredEventTypes: [],
    stateAssertions: ['auth status endpoint returns 200', 'hasAdminAccount is boolean'],
    visibleAssertions: [],
  },
  {
    id: 2,
    name: 'setup or login admin',
    timeoutMs: 15_000,
    requiredEventTypes: [],
    stateAssertions: ['admin token issued', 'authenticated status becomes true'],
    visibleAssertions: [],
  },
  {
    id: 3,
    name: 'create session',
    timeoutMs: 15_000,
    requiredEventTypes: [],
    stateAssertions: ['session id exists', 'workspacePath exists'],
    visibleAssertions: [],
  },
  {
    id: 4,
    name: 'run bash pwd',
    timeoutMs: 15_000,
    requiredEventTypes: ['tool_start', 'tool_result', 'done'],
    stateAssertions: ['bash tool returns non-empty output'],
    visibleAssertions: ['transcript can surface bash lifecycle'],
  },
  {
    id: 5,
    name: 'run read README.md',
    timeoutMs: 15_000,
    requiredEventTypes: ['tool_start', 'tool_result', 'done'],
    stateAssertions: ['read_file returns non-empty content'],
    visibleAssertions: ['transcript can surface read lifecycle'],
  },
  {
    id: 6,
    name: 'run write to workspace scratch file',
    timeoutMs: 15_000,
    requiredEventTypes: ['tool_start', 'tool_result', 'done'],
    stateAssertions: ['write_file acknowledges write', 'scratch file exists'],
    visibleAssertions: ['transcript can surface write lifecycle'],
  },
  {
    id: 7,
    name: 'run bash cat on the scratch file',
    timeoutMs: 15_000,
    requiredEventTypes: ['tool_start', 'tool_result', 'done'],
    stateAssertions: ['bash output matches scratch file contents'],
    visibleAssertions: [],
  },
  {
    id: 8,
    name: 'invoke a known local skill',
    timeoutMs: 15_000,
    requiredEventTypes: ['tool_start', 'tool_result', 'done'],
    stateAssertions: ['skill output is non-empty'],
    visibleAssertions: ['transcript can surface skill lifecycle'],
  },
  {
    id: 9,
    name: 'invoke the same skill again in the same session',
    timeoutMs: 15_000,
    requiredEventTypes: ['tool_start', 'tool_result', 'done'],
    stateAssertions: ['skill remains callable in the same session'],
    visibleAssertions: ['repeat invocation remains visible'],
  },
  {
    id: 10,
    name: 'create connector via admin flow',
    timeoutMs: 15_000,
    requiredEventTypes: [],
    stateAssertions: ['connector create returns 200'],
    visibleAssertions: [],
  },
  {
    id: 11,
    name: 'list connectors and confirm visibility',
    timeoutMs: 15_000,
    requiredEventTypes: [],
    stateAssertions: ['connector appears in admin list'],
    visibleAssertions: ['connector is represented in Admin Studio data sources surface'],
  },
  {
    id: 12,
    name: 'create module draft',
    timeoutMs: 15_000,
    requiredEventTypes: [],
    stateAssertions: ['module draft created'],
    visibleAssertions: [],
  },
  {
    id: 13,
    name: 'refresh module',
    timeoutMs: 15_000,
    requiredEventTypes: [],
    stateAssertions: ['module lifecycleState becomes refreshed'],
    visibleAssertions: [],
  },
  {
    id: 14,
    name: 'publish module with confirm',
    timeoutMs: 15_000,
    requiredEventTypes: [],
    stateAssertions: ['module lifecycleState becomes published'],
    visibleAssertions: [],
  },
  {
    id: 15,
    name: 'fetch modules and confirm published state',
    timeoutMs: 15_000,
    requiredEventTypes: [],
    stateAssertions: ['published module appears in module list'],
    visibleAssertions: ['published state is surfaced in Admin Studio modules view'],
  },
  {
    id: 16,
    name: 'open Admin Studio Modules view and confirm visibility',
    timeoutMs: 15_000,
    requiredEventTypes: [],
    stateAssertions: ['admin module metadata is available'],
    visibleAssertions: ['Admin Studio is a first-class surface and shows the published module'],
  },
  {
    id: 17,
    name: 'send agent prompt that references published module and data source',
    timeoutMs: 15_000,
    requiredEventTypes: ['assistant', 'done'],
    stateAssertions: ['agent prompt completes without crash'],
    visibleAssertions: ['published module is usable from Agent Workspace flow'],
  },
  {
    id: 18,
    name: 'receive runtime events and non-empty visible outcome',
    timeoutMs: 15_000,
    requiredEventTypes: ['assistant', 'done'],
    stateAssertions: ['non-empty assistant or report outcome returned'],
    visibleAssertions: ['Agent Workspace shows the resulting outcome'],
  },
  {
    id: 19,
    name: 'restart server and login again',
    timeoutMs: 15_000,
    requiredEventTypes: [],
    stateAssertions: ['server restart succeeds', 'login succeeds after restart'],
    visibleAssertions: [],
  },
  {
    id: 20,
    name: 're-fetch connectors/modules and confirm persisted state + visible frontend outcome',
    timeoutMs: 15_000,
    requiredEventTypes: [],
    stateAssertions: ['connector persists after restart', 'module persists after restart'],
    visibleAssertions: ['published outcome remains visible after restart'],
  },
]

export function createScenarioResult(
  mode: ScenarioMode,
  logDir: string,
  restartCount = 0,
): ScenarioRunResult {
  return {
    suite: BUILD_STUDIO_20_SUITE,
    mode,
    status: 'pass',
    failure_code: null,
    steps: [],
    restart_count: restartCount,
    log_dir: logDir,
  }
}

export function finalizeScenarioResult(result: ScenarioRunResult): ScenarioRunResult {
  const failedStep = result.steps.find((step) => step.status === 'fail')
  return {
    ...result,
    status: failedStep ? 'fail' : 'pass',
  }
}
