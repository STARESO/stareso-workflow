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

test('the panel draws the progress view from the tool, on every surface', async ($, on) => {
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
    // one Progress tab: the brief's context, the milestone's numbers by state with its ETA and its title, then the
    // running helper folded to one line (its mark in the running colour), its card a press away
    expect(await ui.find({ type: 'Text', text: /^Build phase$/ })).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /^demo$/ }))?.props.size).toBe('title')
    expect(await ui.find({ type: 'Text', text: /^All done ≈ 19:00$/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^≈ 19:00$/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^First steps$/ })).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /^▶$/ }))?.props.color).toBe('warning')
    expect(await ui.find({ type: 'Text', text: /^Second step$/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^running since/ })).toBeFalsy()
    await ui.press({ key: 'h:M1.2' })
    expect((await ui.find({ type: 'Text', text: /^running since/ }))?.text).toContain('16:55')
    await ui.press({ key: 'close-card' })
    // the plan windows are left to the Usage tab, the Brief and Graph tabs are one
    expect(await ui.find({ type: 'Text', text: /5-hour/ })).toBeFalsy()
    expect(await ui.find({ type: 'Button', key: 'view-text' })).toBeFalsy()
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
  // a folder this session settled on that fails (as an older version kept one) still falls back
  const again = await $.command.run({ command: 'stareso-panel', args: '/home/me/.claude' })
  expect(again.text).toContain('open on demo')
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
function engine(on: Parameters<Parameters<typeof test>[1]>[1], open: boolean, sessions: unknown[] | null = null) {
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
  // the app's session list when a test gives one, else no app tools here (the panel's own family, `linked`, is
  // empty here); a row marked `self` is the panel's own chat: left out of the list, answered by get_session self
  const rows = (sessions ?? []) as { self?: boolean }[]
  const reply = (v: unknown) => ({ value: { content: [{ type: 'text', text: JSON.stringify(v) }], isError: false } })
  on('mcp.call', (_, e) => (sessions && e.tool === 'list_sessions' ? reply(e.args.linked ? [] : rows.filter(x => !x.self))
    : sessions && e.tool === 'get_session' ? reply(rows.find(x => x.self) ?? null)
    : { value: { content: [], isError: true } }))
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

test('the progress view draws a row per milestone, a pressed milestone lists its slices, and a pressed slice opens its card', async ($, on) => {
  engine(on, false)
  await $.session.start({ cwd: '/work/demo', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'stareso-panel', args: 'graph' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /≈ 19:00/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^M1\.2 · Second step$/ })).toBeFalsy()
    // each slice number a plain Button that opens the slice's card, on a chip in its state's colour (a desktop drops
    // the colour of a Text inside a Button)
    expect((await ui.find({ type: 'Button', key: 'c:M1.2' }))?.text).toBe('2')
    expect((await ui.findAll({ type: 'Box' })).filter(b => b.props.backgroundColor === 'warning')).toHaveLength(1)
    await ui.press({ key: 'c:M1.2' })
    expect(await ui.find({ type: 'Text', text: /^M1.2 · Second step$/ })).toBeTruthy()
    await ui.press({ key: 'close-card' })
    await ui.press({ key: 'l:M1' })
    expect(await ui.find({ type: 'Text', text: /^M1 · First steps$/ })).toBeTruthy()
    await ui.press({ key: 's:M1.2' })
    expect(await ui.find({ type: 'Text', text: /^M1\.2 · Second step$/ })).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /^running since/ }))?.text).toContain('16:55')
    await ui.press({ key: 'close-card' })
    await ui.unmount()
  }
})

test('the usage view draws the plan windows, the tiles and the seven charts', async ($, on) => {
  engine(on, false)
  await $.session.start({ cwd: '/work/demo', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'stareso-panel', args: 'usage' })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Plan usage now/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /^166\.6M$/ })).toBeTruthy()
    for (const n of [1, 2, 3, 4, 5, 6, 7]) expect(await ui.find({ type: 'Text', text: new RegExp(`^${n}\\. `) })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /over 300 turns/ })).toBeTruthy()
    await ui.unmount()
  }
})

test('the progress view lists the chats of the project, working or idle', async ($, on) => {
  const recent = new Date(Date.now() - 3600_000).toISOString()
  const old = new Date(Date.now() - 3 * 24 * 3600_000).toISOString()
  engine(on, false, [
    { sessionId: 'a', title: 'Build all open milestones (fast)', cwd: '\\work\\demo\\', isRunning: true, lastActivityAt: recent },
    // started from a project chat but running elsewhere: one of the project's chats all the same
    { sessionId: 'b', startedBy: 'a', title: 'Side chat in the home folder', cwd: '/home/me/.claude', isRunning: false, lastActivityAt: recent },
    { sessionId: 'c', title: 'Unrelated chat', cwd: '/home/me/.claude', isRunning: true },
    { title: 'Side question', cwd: '/work/demo/.claude/worktrees/x', isRunning: true },
    // a manager waiting on the step it launched counts as active
    { sessionId: 'm', title: 'Waiting manager', cwd: '/work/demo', isRunning: false, lastActivityAt: recent },
    { sessionId: 'k', startedBy: 'm', title: 'Launched test step', cwd: '/home/me/.claude', isRunning: true, lastActivityAt: recent },
    { sessionId: 'me', self: true, title: 'This chat', cwd: '/work/demo', isRunning: true, lastActivityAt: recent },
    { title: 'Last week', cwd: '/work/demo', isRunning: false, lastActivityAt: old },
    { title: 'Other project', cwd: '/work/other', isRunning: true },
  ])
  await $.session.start({ cwd: '/work/demo', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'stareso-panel', args: 'brief' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^Chats$/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /^5 active, 1 idle$/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /^Side chat in the home folder$/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /^Build all open milestones \(fast\)$/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /^Side question$/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /^Waiting manager$/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /^managing$/ })).toBeTruthy()
  // the chat the panel draws in, which the app leaves out of its own list
  expect(await ui.find({ type: 'Text', text: /^This chat/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /Last week|Other project|Unrelated chat/ })).toBeFalsy()
  await ui.unmount()
})

test('a stareso button in the prompt footer opens the panel', async ($, on) => {
  const seen = engine(on, false)
  await $.session.start({ cwd: '/work/demo', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'stareso-status', component: 'SessionMode', props: { modes: ['focus'] }, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^focus$/ })).toBeTruthy()
  await ui.press({ key: 'stareso-toggle' })
  expect(seen.opened).toBe(1)
  await ui.unmount()
})
