import { describe, expect, test } from 'bun:test'
import {
  BUILD_STUDIO_20_STEPS,
  BUILD_STUDIO_20_SUITE,
  FAILURE_CODES,
  createScenarioResult,
  finalizeScenarioResult,
} from '../../scenario/buildStudio20'

describe('BUILD_STUDIO_20@v1 scenario contract', () => {
  test('defines the expected suite metadata and all 20 steps', () => {
    expect(BUILD_STUDIO_20_SUITE).toBe('BUILD_STUDIO_20@v1')
    expect(BUILD_STUDIO_20_STEPS).toHaveLength(20)
    expect(BUILD_STUDIO_20_STEPS.map((step) => step.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ])
    expect(BUILD_STUDIO_20_STEPS.slice(3, 9).every((step) => step.requiredEventTypes.includes('tool_start'))).toBe(true)
  })

  test('exposes the machine-checkable failure code taxonomy', () => {
    expect(FAILURE_CODES).toEqual([
      'CRASH_PROCESS_EXIT',
      'HANG_TIMEOUT',
      'BLANK_RESULT',
      'MISSING_REQUIRED_EVENT',
      'STATE_CORRUPTION',
      'STALE_STATE_AFTER_RESTART',
      'MIXED_PATH_LEAK',
      'VISIBILITY_MISMATCH',
    ])
  })

  test('finalizes run status based on step failures', () => {
    const passing = createScenarioResult('shadow', '/tmp/logs', 0)
    passing.steps.push({
      step_id: 1,
      name: 'ok',
      status: 'pass',
      expected_event_count: 0,
      actual_event_count: 0,
      timeout_ms: 1,
      source_path: [],
      state_assertions: [],
      visible_assertions: [],
    })

    const failing = createScenarioResult('primary', '/tmp/logs', 3)
    failing.steps.push({
      step_id: 1,
      name: 'fail',
      status: 'fail',
      expected_event_count: 1,
      actual_event_count: 0,
      timeout_ms: 1,
      source_path: [],
      state_assertions: [],
      visible_assertions: [],
      details: 'Missing events: done',
    })

    expect(finalizeScenarioResult(passing).status).toBe('pass')
    expect(finalizeScenarioResult(failing).status).toBe('fail')
  })
})
