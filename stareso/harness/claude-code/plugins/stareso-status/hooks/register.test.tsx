import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'stareso-status',
  component: 'Pane',
  requestId: 'stareso-status',
  props: {
    title: 'stareso status',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const SNAPSHOT = {
  project: 'demo',
  root: '/work/demo',
  brief: 'demo · Phase: build\n\nProgress   ■ done  ▶ running  □ waiting\n  M1    1/3    ■▶□  ≈ 17:00',
  graph: {
    mode: 'eco · 1 helper', allDone: '19:00', pace: '30 min per slice', hidden: [], finished: [],
    lanes: [{ id: 'M1', title: 'First steps', kind: 'app', done: 1, total: 3, block: false, eta: '≈ 19:00', slices: ['M1.1', 'M1.2', 'M1.3'] }],
    slices: {
      'M1.1': { title: 'Start', ms: 'M1', state: 'done', after: [] },
      'M1.2': { title: 'Second step', ms: 'M1', state: 'running', after: ['M1.1'], model: 'sonnet', minutes: 5, started: '16:55', branch: 'slice/M1.2-second', eta: '17:30' },
      'M1.3': { title: 'Third step', ms: 'M1', state: 'waiting', after: ['M1.2'], eta: '18:00' },
    },
  },
  recentMerges: [{ id: 'M1.1', at: '2026-10-22 16:00' }],
  running: [{ id: 'M1.2', minutes: 5 }],
  perSliceMinutes: 30,
  usage: { five: { pct: 42, resets: '21:00', ratePerHour: 8, basis: 'last readings', reach: [{ name: 'pause', cap: 90, at: '19:10' }] }, week: null },
}

test('the panel draws the brief from the tool, on every surface', async ($, on) => {
  on('command.register', () => ({ value: { command: 'stareso-panel' } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('env.get', () => ({ value: '/home/me' }))
  on('session.cwd', () => ({ value: '/work/demo' }))
  on('clock.every', () => ({ value: {} }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify(SNAPSHOT), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('mcp.call', () => ({ value: { content: [{ type: 'text', text: '{}' }], isError: false } }))

  await $.session.start({ cwd: '/work/demo', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run({ command: 'stareso-panel', args: '/work/demo' })
  expect(ran.text).toContain('demo')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /demo/ })).toBeTruthy()
    await ui.unmount()
  }
})

test('a folder that is not a stareso project says so', async ($, on) => {
  on('command.register', () => ({ value: { command: 'stareso-panel' } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('env.get', () => ({ value: '/home/me' }))
  on('session.cwd', () => ({ value: '/work/demo' }))
  on('clock.every', () => ({ value: {} }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  // what Node prints for an uncaught throw: the source line first, then the error
  const stderr = [
    'file:///home/me/.claude/stareso/tools/lib/roadmap.mjs:11',
    '    if (parent === dir) throw new Error("No docs/ROADMAP.md found: run from inside a stareso project.");',
    '                              ^',
    '',
    'Error: No docs/ROADMAP.md found: run from inside a stareso project.',
    '    at findRoot (file:///home/me/.claude/stareso/tools/lib/roadmap.mjs:11:31)',
  ].join('\n')
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr, isStdoutTruncated: false, isStderrTruncated: false } }))
  on('mcp.call', () => ({ value: { content: [], isError: true } }))

  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run({ command: 'stareso-panel', args: '/tmp' })
  expect(ran.text).toContain('/tmp: No docs/ROADMAP.md found: run from inside a stareso project. Type /stareso-panel')
  expect(ran.text).not.toContain('throw new Error')
})

test('a side session outside the project reads the project another session read', async ($, on) => {
  on('command.register', () => ({ value: { command: 'stareso-panel' } }))
  on('store.get', () => ({ value: '/work/demo' }))
  on('store.set', () => ({ value: undefined }))
  on('env.get', () => ({ value: '/home/me' }))
  on('session.cwd', () => ({ value: '/home/me/.claude' }))
  on('clock.every', () => ({ value: {} }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('mcp.call', () => ({ value: { content: [], isError: true } }))
  on('process.run', (_, e) => {
    const argv = (e as { argv: string[] }).argv
    return argv.includes('/work/demo')
      ? { value: { exitCode: 0, stdout: JSON.stringify(SNAPSHOT), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
      : { value: { exitCode: 1, stdout: '', stderr: 'Error: No docs/ROADMAP.md found', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  await $.session.start({ cwd: '/home/me/.claude', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run({ command: 'stareso-panel', args: '' })
  expect(ran.text).toContain('open on demo')
})

const CHARTS = {
  unit: '≈ equiv (frozen weights, not money)',
  tiles: [{ label: 'Workflow cost', value: '166.6M' }, { label: 'Slices built', value: '3' }],
  shareByType: [{ type: 'build', share: 60, equiv: 1e8, hours: 5, turns: 300 }, { type: 'chat', share: 40, equiv: 6e7, hours: 2, turns: 200 }],
  cumulative: { kinds: ['build', 'chat'], days: [{ day: 0, date: '2026-10-21' }, { day: 1, date: '2026-10-22' }], points: [{ day: 0.2, build: 10, chat: 5 }, { day: 1.4, build: 100, chat: 60 }] },
  milestones: [{ id: 'M1', built: 'helpers', equivPerSlice: 4.8e6, measured: '3/3', slices: 3 }],
  referencePerSlice: { label: 'project A M5', equiv: 335000 },
  conductorVsHelpers: [{ session: '6', date: '2026-10-21', type: 'build', merged: 3, conductor: 2e6, helpers: 6e6, helperCount: 3 }],
  sessions: [{ n: 1, date: '2026-10-21', ctx: 120000, turns: 120, equiv: 1e7, helpers: 2, over300: false }, { n: 2, date: '2026-10-22', ctx: 400000, turns: 900, equiv: 9e7, helpers: 0, over300: true }],
  slices: [{ id: 'M1.1', tier: 'standard', tokens: 30000, lines: 100, outlier: false }, { id: 'M1.2', tier: 'strong', tokens: 400000, lines: 50, outlier: true }],
  tierMedians: [{ tier: 'standard', model: 'sonnet', tokens: 30000, lines: 100, per100: 30000 }],
}

// the engine beneath the plugin; what it answers counts the pane openings
function engine(on: Parameters<Parameters<typeof test>[1]>[1], open: boolean) {
  const seen = { opened: 0 }
  on('command.register', () => ({ value: { command: 'stareso-panel' } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('env.get', () => ({ value: '/home/me' }))
  on('session.cwd', () => ({ value: '/work/demo' }))
  on('clock.every', () => ({ value: {} }))
  on('ui.panes', () => ({ value: open ? [{ id: 'stareso-status', title: 'stareso status' }] : [] }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.open', () => { seen.opened += 1; return { value: { isPlaced: true } } })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('mcp.call', () => ({ value: { content: [], isError: true } }))
  on('process.run', (_, e) => {
    const argv = (e as { argv: string[] }).argv
    const stdout = argv.some(a => a.endsWith('usage-report.mjs')) ? JSON.stringify({ charts: CHARTS, tables: '**1. By type of step**' }) : JSON.stringify(SNAPSHOT)
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return seen
}

test('the same command hides an open panel', async ($, on) => {
  engine(on, true)
  await $.session.start({ cwd: '/work/demo', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run({ command: 'stareso-panel', args: '' })
  expect(ran.text).toContain('hidden')
})

test('the graph view draws a row per milestone, and a pressed slice opens its card', async ($, on) => {
  engine(on, false)
  await $.session.start({ cwd: '/work/demo', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'stareso-panel', args: 'graph' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /≈ 19:00/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^M1\.2 · Second step$/ })).toBeFalsy()
    await ui.press({ key: 's:M1.2' })
    expect(await ui.find({ type: 'Text', text: /^M1\.2 · Second step$/ })).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /^running since/ }))?.text).toContain('16:55')
    await ui.press({ key: 'close-card' })
    await ui.unmount()
  }
})

test('the band above the prompt gives the status and opens the panel', async ($, on) => {
  const seen = engine(on, false)
  await $.session.start({ cwd: '/work/demo', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'stareso-panel', args: '/work/demo' })
  const before = seen.opened
  const BAND = {
    plugin: 'stareso-status', component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 80, scroll: { offset: 0, bodyRows: 6 }, view: {} },
  } as const
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /running/ }))?.text).toContain('all done ≈ 19:00')
    await ui.press({ key: 'toggle-panel' })
    await ui.unmount()
  }
  expect(seen.opened).toBeGreaterThan(before)
})

test('the usage view draws the plan windows, the tiles and the six charts', async ($, on) => {
  engine(on, false)
  await $.session.start({ cwd: '/work/demo', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'stareso-panel', args: 'usage' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Plan usage now/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^166\.6M$/ })).toBeTruthy()
    for (const n of [1, 2, 3, 4, 5, 6]) expect(await ui.find({ type: 'Text', text: new RegExp(`^${n}\\. `) })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /over 300 turns/ })).toBeTruthy()
    await ui.unmount()
  }
})
