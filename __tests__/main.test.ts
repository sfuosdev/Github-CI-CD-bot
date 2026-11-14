/**
 * Unit tests for the action's main functionality, src/main.ts
 */
import { describe, it, afterEach, expect, jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

describe('main.ts', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Says hello with the CI result', async () => {
    core.getInput.mockReturnValue('success')

    await run()

    // Verify the time output was set.
    expect(core.info).toHaveBeenCalledWith(
      'Hello from ci-cd bot! CI result: success'
    )
  })
})
