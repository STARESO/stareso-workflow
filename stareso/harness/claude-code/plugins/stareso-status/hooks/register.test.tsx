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
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
  recentMerges: [{ id: 'M1.1', at: '2026-10-22 16:00' }],
  running: [{ id: 'M1.2', minutes: 5 }],
  perSliceMinutes: 30,
  usage: { five: null, week: null },
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

test('the graph view draws the graph alone, at the height its viewBox gives', async ($, on) => {
  engine(on, false)
  await $.session.start({ cwd: '/work/demo', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'stareso-panel', args: 'graph' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const svg = (await ui.find({ type: 'Svg' })) as { props?: { width?: number; height?: number } } | undefined
  expect(svg?.props?.height).toBeGreaterThan(0)
  expect(svg?.props?.height).toBe(svg?.props?.width)
  expect(await ui.find({ type: 'Code' })).toBeFalsy()
  await ui.unmount()
})

const CHARTS = {
  tiles: [{ label: 'Workflow cost', value: '166.6M' }],
  shareByType: [{ type: 'build', share: 60, equiv: 1e8 }, { type: 'chat', share: 40, equiv: 6e7 }],
  milestones: [{ id: 'M1', equivPerSlice: 4.8e6, slices: 3 }],
  referencePerSlice: { label: 'project A M5', equiv: 335000 },
}

function engine(on: Parameters<Parameters<typeof test>[1]>[1], open: boolean) {
  on('command.register', () => ({ value: { command: 'stareso-panel' } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('env.get', () => ({ value: '/home/me' }))
  on('session.cwd', () => ({ value: '/work/demo' }))
  on('clock.every', () => ({ value: {} }))
  on('ui.panes', () => ({ value: open ? [{ id: 'stareso-status', title: 'stareso status' }] : [] }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('mcp.call', () => ({ value: { content: [], isError: true } }))
  on('process.run', (_, e) => {
    const argv = (e as { argv: string[] }).argv
    const stdout = argv.includes('--charts') ? JSON.stringify(CHARTS) : argv.some(a => a.endsWith('usage-report.mjs')) ? '**1. By type of step**' : JSON.stringify(SNAPSHOT)
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
}

test('the same command hides an open panel', async ($, on) => {
  engine(on, true)
  await $.session.start({ cwd: '/work/demo', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run({ command: 'stareso-panel', args: '' })
  expect(ran.text).toContain('hidden')
})

test('the usage view draws the tiles from usage-report', async ($, on) => {
  engine(on, false)
  await $.session.start({ cwd: '/work/demo', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'stareso-panel', args: 'usage' })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /Workflow cost/ }))?.text).toContain('166.6M')
  await ui.unmount()
})
