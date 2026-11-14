export const context = {
  eventName: 'pull_request',
  repo: {
    repo: 'Hello-World'
  },
  runId: 12345,
  payload: {
    pull_request: {
      number: 42,
      base: { sha: 'base-sha-123' },
      head: { sha: 'head-sha-456' }
    }
  }
}
