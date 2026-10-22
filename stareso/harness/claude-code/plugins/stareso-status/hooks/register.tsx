// Live stareso status: a pane beside the chat that runs ~/.claude/stareso/tools/progress-graph.mjs every minute while
// it is open and draws its brief (aligned columns, slices in the colour of their state, the chats computing in the
// project), its graph (one row of slices per milestone, to hover and press) or the
// project's usage (the plan windows, then the tiles and six charts of the stareso-usage skill from usage-report.mjs
// --live), with toasts when a slice merges, a helper starts, a helper runs past twice the usual slice time, or a usage
// cap comes within 15 minutes. Everything is drawn with the surface's own elements, so the terminal draws it too.
// No model call: only the tools, git and the app's own usage reading.
//
//   /stareso-panel                 opens the panel, or hides it when it is open
//   /stareso-panel <folder>        opens it on that project (remembered across sessions)
//   /stareso-panel graph | usage | brief   opens it on that view
//   /stareso-panel dashboard       starts ~/.claude/stareso/tools/dashboard.mjs for the project (the Chart.js charts of
//                                  /stareso-usage and the progress graph, refreshing itself) and opens it in the side browser
import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register, RenderElement } from 'claude-code'

import type { PanelGraph, PanelLane, PanelSlice, PanelView, SliceState, UsageCharts, UsageWindow } from '../types'

const PANE = 'stareso-status'
const TITLE = 'stareso status'
const EVERY_MS = 60_000
// the usage report (a few seconds) is read again while its view is open once it is older than this, or a slice merged
const USAGE_STALE_MS = 5 * 60_000
const WIDE = 110
const EMPTY: PanelView = {
  project: '', root: '', brief: '', graph: null, windows: null, updated: '', error: '', view: 'text', selected: '',
  showFinished: false, usageNote: '', usage: null, usageMd: '', usageAt: 0, usageMerge: '', usageError: '', showTables: false, chats: [],
}
const panel = atom({ plugin: 'stareso-status', key: 'panel' } as const, EMPTY)

type Snapshot = {
  project: string
  root: string
  brief: string
  graph: PanelGraph
  recentMerges: { id: string; at: string }[]
  running: { id: string; minutes: number | null }[]
  perSliceMinutes: number | null
  usage: { five: UsageWindow; week: UsageWindow }
}
type UI = Pick<Elements['terminal'], 'Box' | 'Text' | 'Button' | 'Markdown' | 'Code'>
type Act = (fn: (p: PanelView) => PanelView) => () => void
type Seg = { text: string; color?: string }

let inflight: Promise<void> | null = null
let usageInflight: Promise<void> | null = null
let ticking = false
let latestMerge = ''
let seen: { merge?: string; running: Set<string>; alerted: Set<string> } | null = null

function clock(at = Date.now()): string {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function toolPath($: EngineInterface, name: string): Promise<string> {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? ''
  return `${home}/.claude/stareso/tools/${name}`
}

async function isOpen($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some(p => p.id === PANE)
}

// The plan windows from the app's own usage tool, as the tool's --five / --week flags; none when it is not there.
async function usageFlags($: EngineInterface): Promise<string[]> {
  try {
    const res = await $.mcp.call('ccd_session_mgmt', 'get_usage', {})
    const block = res.content.find(c => c.type === 'text') as { text?: string } | undefined
    const plan = JSON.parse(block?.text ?? '{}').plan
    const flags: string[] = []
    for (const w of plan?.windows ?? []) {
      if (/5-hour/i.test(w.label)) flags.push('--five', `${w.percentUsed}@${w.resetsAt}`)
      else if (/weekly · all/i.test(w.label)) flags.push('--week', `${w.percentUsed}@${w.resetsAt}`)
    }
    return flags
  } catch {
    return []
  }
}

// The app's chats that are working now in the project folder or below it (its worktrees), from its own session list;
// none when the app does not give it. The session the panel draws in is not listed.
async function activeChats($: EngineInterface, root: string): Promise<PanelView['chats']> {
  const norm = (f: string) => f.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  try {
    const res = await $.mcp.call('ccd_session_mgmt', 'list_sessions', { limit: 40 })
    const block = res.content.find(c => c.type === 'text') as { text?: string } | undefined
    const rows = JSON.parse(block?.text ?? '[]') as { title?: string; cwd?: string; isRunning?: boolean; lastActivityAt?: string }[]
    const r = norm(root)
    return (Array.isArray(rows) ? rows : [])
      .filter(x => x.isRunning && x.cwd && (norm(x.cwd) === r || norm(x.cwd).startsWith(`${r}/`)))
      .map(x => ({ title: x.title || 'untitled chat', at: x.lastActivityAt ? clock(Date.parse(x.lastActivityAt)) : '' }))
  } catch {
    return []
  }
}

function alerts($: EngineInterface, s: Snapshot) {
  const first = seen === null || (seen.merge === undefined && seen.running.size === 0)
  const prev = seen ?? { running: new Set<string>(), alerted: new Set<string>() }
  const now = { merge: s.recentMerges[0]?.id, running: new Set(s.running.map(r => r.id)), alerted: prev.alerted }
  if (!first) {
    if (now.merge && now.merge !== prev.merge) void $.ui.toast(`✓ ${now.merge} merged`)
    for (const id of now.running) if (!prev.running.has(id)) void $.ui.toast(`▶ ${id} started`)
  }
  const slow = (s.perSliceMinutes ?? 0) * 2
  for (const r of s.running) {
    const key = `slow:${r.id}`
    if (slow && (r.minutes ?? 0) > slow && !now.alerted.has(key)) {
      now.alerted.add(key)
      void $.ui.toast(`${r.id} has run ${r.minutes} min, past twice the usual ${s.perSliceMinutes} min`)
    }
  }
  for (const [name, w] of [['5-hour', s.usage?.five], ['weekly', s.usage?.week]] as const) {
    for (const r of w?.reach ?? []) {
      const key = `cap:${name}:${r.name}:${w?.resets}`
      if (r.at && !now.alerted.has(key) && (r.at === 'reached' || minutesUntil(r.at) <= 15)) {
        now.alerted.add(key)
        void $.ui.toast(`${name} window: ${r.name} cap ${r.cap} % ${r.at === 'reached' ? 'reached' : `at about ${r.at}`}`)
      }
    }
  }
  seen = now
}

// One read at a time: a refresh asked while one runs (the command right after a timer read) waits, then reads again.
// `force` reads the usage report too when its view is open (the Refresh button).
async function refresh($: EngineInterface, force = false) {
  while (inflight) await inflight
  inflight = readOnce($)
  try {
    await inflight
  } finally {
    inflight = null
  }
  const p = await panelState($)
  if (p.view === 'usage' && (force || usageDue(p))) await readUsage($)
}

// the panel state with every field: a state kept from an older version of the mod lacks the newer ones
async function panelState($: EngineInterface): Promise<PanelView> {
  return { ...EMPTY, ...(await read($, panel)) }
}

// The folders to read, in order: the one this session settled on (a /stareso-panel <folder>, or the last good read),
// then the session's own folder, then the last project any session read (a side session often starts outside it).
// The settled one does not stop the others: an older version of the mod kept a folder that had failed.
async function projectRoots($: EngineInterface): Promise<string[]> {
  const state = await read($, panel)
  const remembered = (await $.store.get('project')) as string | undefined
  const cwd = await $.session.cwd()
  return [...new Set([state.root, cwd, remembered].filter((r): r is string => !!r))]
}

async function projectRoot($: EngineInterface): Promise<string> {
  return (await projectRoots($))[0] ?? ''
}

// Node prints the throwing source line (and a caret) before the error itself: keep the "Error: ..." line, without its
// prefix or final period, else the first non-empty line
function errorLine(output: string): string {
  const lines = output.split('\n').map(l => l.trim()).filter(Boolean)
  const line = lines.find(l => /^\w*Error: /.test(l)) ?? lines[0] ?? ''
  return line.replace(/^\w*Error: /, '').replace(/\.$/, '').slice(0, 200)
}

async function readOnce($: EngineInterface) {
  try {
    const roots = await projectRoots($)
    const flags = await usageFlags($)
    const tool = await toolPath($, 'progress-graph.mjs')
    let run: Awaited<ReturnType<typeof $.process.run>> | null = null
    let firstError = ''
    for (const root of roots) {
      run = await $.process.run(['node', tool, '--root', root, '--panel', '--max-lanes', '99', ...flags], { timeoutMs: 20_000 })
      if (run.exitCode === 0) break
      firstError ||= `${root}: ${errorLine(run.stderr) || `progress-graph.mjs exited with ${run.exitCode}`}`
    }
    if (!run || run.exitCode !== 0) {
      // the root is not kept: a later /stareso-panel <folder>, or a project read by another session, still gets its turn
      await update($, panel, p => ({ ...p, updated: clock(), error: `${firstError}. Type /stareso-panel <project folder>.` }))
      return
    }
    const s = JSON.parse(run.stdout) as Snapshot
    await $.store.set('project', s.root)
    latestMerge = s.recentMerges[0]?.id ?? ''
    alerts($, s)
    const chats = await activeChats($, s.root)
    await update($, panel, p => ({
      ...p, project: s.project, root: s.root, brief: s.brief, graph: s.graph, windows: s.usage, chats, updated: clock(), error: '',
      usageNote: flags.length ? '' : 'usage windows not readable here',
    }))
  } catch (err) {
    await update($, panel, p => ({ ...p, updated: clock(), error: String(err).slice(0, 200) }))
  }
}

function usageDue(p: PanelView): boolean {
  return !p.usageAt || Date.now() - p.usageAt > USAGE_STALE_MS || (latestMerge !== '' && latestMerge !== p.usageMerge)
}

// usage-report.mjs --live --panel: current numbers from the transcripts (nothing written in the project), charts and
// tables from one run of a few seconds; one at a time
async function readUsage($: EngineInterface) {
  if (usageInflight) return usageInflight
  usageInflight = (async () => {
    try {
      const root = await projectRoot($)
      const run = await $.process.run(['node', await toolPath($, 'usage-report.mjs'), '--live', '--panel'], { cwd: root, timeoutMs: 90_000 })
      if (run.exitCode !== 0) {
        const why = errorLine(`${run.stderr}\n${run.stdout}`) || 'no usage report'
        await update($, panel, p => ({ ...p, usageAt: Date.now(), usageMerge: latestMerge, usageError: why }))
        return
      }
      const r = JSON.parse(run.stdout) as { charts: UsageCharts; tables: string }
      await update($, panel, p => ({
        ...p, usageAt: Date.now(), usageMerge: latestMerge, usageError: '', usage: r.charts, usageMd: r.tables.trim(),
      }))
    } catch (err) {
      await update($, panel, p => ({ ...p, usageAt: Date.now(), usageError: String(err).slice(0, 200) }))
    } finally {
      usageInflight = null
    }
  })()
  return usageInflight
}

// The minute timer starts with the first opening, and reads only while the panel is open.
function startTicking($: EngineInterface) {
  if (ticking) return
  ticking = true
  $.clock.every(EVERY_MS, () => {
    isOpen($).then(open => (open ? refresh($) : undefined)).catch(() => undefined)
  })
}

// The dashboard server, one per project folder: started by the mod, it lives as long as the mod is loaded (or until its
// idle limit), and a second start on the same project only prints the address of the running one.
const dashboards = new Map<string, string>()

async function openDashboard($: EngineInterface): Promise<string> {
  const root = await projectRoot($)
  let url = dashboards.get(root) ?? ''
  if (!url) {
    const tool = await toolPath($, 'dashboard.mjs')
    url = await new Promise<string>(resolve => {
      void (async () => {
        let found = false
        try {
          for await (const piece of $.process.spawn({ argv: ['node', tool, '--root', root] })) {
            const m = /http:\/\/127\.0\.0\.1:\d+/.exec(piece.text)
            if (m && !found) {
              found = true
              dashboards.set(root, m[0])
              resolve(m[0])
            }
          }
        } catch {
          // it could not start: said below
        }
        if (!found) resolve('')
        // the child ended (or only pointed at a running one): the next opening asks again
        dashboards.delete(root)
      })()
    })
  }
  if (!url) return 'the dashboard did not start (node ~/.claude/stareso/tools/dashboard.mjs --root <project> says why)'
  try {
    const res = await $.mcp.call('Claude_Browser', 'preview_start', { url })
    if (res.isError) throw new Error('not opened')
    return `dashboard open in the side browser: ${url}`
  } catch {
    return `dashboard running: open ${url} in the side browser`
  }
}

async function show($: EngineInterface, view: PanelView['view']) {
  await update($, panel, p => ({ ...p, view }))
  // the graph and the usage charts want a wide dock; a width the person dragged wins
  await $.ui.open({ id: PANE, title: TITLE, ...(view === 'text' ? {} : { columns: WIDE }) })
  if (view === 'usage' && usageDue(await panelState($))) await readUsage($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'stareso-panel',
      description: 'Live stareso status beside the chat: opens or hides it (optional: a project folder, graph, usage, brief, or dashboard)',
      argumentHint: '[project folder | graph | usage | brief | dashboard]',
    })

    return next(e)
  })

  on('command.run', { command: 'stareso-panel' }, async ($, e) => {
    const arg = (e.args ?? '').trim().replace(/^"|"$/g, '')
    const views: Record<string, PanelView['view']> = { graph: 'graph', usage: 'usage', brief: 'text', text: 'text' }
    if (arg === 'dashboard') return { text: `stareso ${await openDashboard($)}` }
    if (!arg && (await isOpen($))) {
      await $.ui.close({ id: PANE })
      return { text: 'stareso panel hidden: /stareso-panel shows it again.' }
    }
    if (arg && !views[arg]) {
      await $.store.set('project', arg)
      await update($, panel, p => ({ ...p, root: arg, selected: '', usage: null, usageMd: '', usageAt: 0, usageError: '' }))
      seen = null
    }
    startTicking($)
    await refresh($)
    await show($, views[arg] ?? (await read($, panel)).view)
    const p = await panelState($)

    return { text: p.error ? `stareso panel: ${p.error}` : `stareso panel open on ${p.project}: /stareso-panel again hides it.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button, Code } = ui
    const p = await panelState($)
    const cols = Math.max(48, e.props.bodyColumns ?? 80)
    const act: Act = fn => () => void update($, panel, fn).catch(() => undefined)
    const tab = (view: PanelView['view'], label: string) => (
      <Button key={`view-${view}`} variant={p.view === view ? 'primary' : 'secondary'} onPress={() => void show($, view).catch(() => undefined)}>{label}</Button>
    )

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" gap={1}>
          <Text bold>{p.project || 'stareso'}</Text>
          <Text dimColor>{p.updated ? `updated ${p.updated}` : 'reading…'}</Text>
          <Button key="refresh" onPress={() => void refresh($, true).catch(() => undefined)}>Refresh</Button>
          <Button key="dashboard" onPress={() => void openDashboard($).then(t => $.ui.toast(t)).catch(() => undefined)}>Dashboard</Button>
          <Button key="hide" role="dismiss" dimColor onPress={() => void $.ui.close({ id: PANE }).catch(() => undefined)}>Hide</Button>
        </Box>
        <Box flexDirection="row" gap={1}>
          {tab('text', 'Brief')}
          {tab('graph', 'Graph')}
          {tab('usage', 'Usage')}
        </Box>
        {p.error !== '' && <Text color="error">{p.error}</Text>}
        {p.view === 'text' && (p.graph ? briefView(ui, p, p.graph, cols) : p.brief !== '' && <Code source={p.brief} language="text" />)}
        {p.view === 'graph' && (p.graph ? graphView(ui, p, p.graph, act) : <Text dimColor>reading the graph…</Text>)}
        {p.view === 'usage' && usageView(ui, p, cols, act)}
        {p.view !== 'usage' && p.usageNote !== '' && <Text dimColor>{p.usageNote}</Text>}
      </Box>
    )
  })
}

const STATE: Record<SliceState, { color: string; label: string; mark: string }> = {
  done: { color: 'success', label: 'done', mark: '■' },
  running: { color: 'warning', label: 'running', mark: '▶' },
  ready: { color: 'suggestion', label: 'could start now', mark: '■' },
  you: { color: 'permission', label: 'waits on you', mark: '■' },
  waiting: { color: 'inactive', label: 'waiting', mark: '□' },
}

// ---------- the brief: the tool's sections as aligned columns, every slice in the colour of its state ----------

const SECTION = /^(Progress|Helpers|Usage|Pace|Waits for you|Could start now)\b\s*(.*)$/
const SLICE_ID = /\b([A-Z][A-Za-z]*\d*\.(?:\d+|tidy))\b/

// the brief's sections by heading: the rest of the heading line, then its lines without their indent
function sections(brief: string): Map<string, { head: string; lines: string[] }> {
  const out = new Map<string, { head: string; lines: string[] }>()
  let cur: { head: string; lines: string[] } | null = null
  for (const line of brief.split('\n').slice(1)) {
    const m = SECTION.exec(line)
    if (m) out.set(m[1] ?? '', (cur = { head: m[2] ?? '', lines: [] }))
    else if (cur && line.trim()) cur.lines.push(line.trim())
  }
  return out
}

// a line of the brief with each slice id it names in the colour of its state
function sliceText(ui: UI, g: PanelGraph, text: string, style: { dimColor?: boolean; bold?: boolean } = {}) {
  const { Text } = ui
  const parts = text.split(new RegExp(SLICE_ID.source, 'g'))
  return (
    <Text {...style}>
      {parts.map((t, i) => {
        const s = i % 2 ? g.slices[t] : undefined
        return s ? <Text color={STATE[s.state].color} dimColor={false}>{t}</Text> : t
      })}
    </Text>
  )
}

function heading(ui: UI, name: string, head = '') {
  const { Box, Text } = ui
  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
      <Text bold>{name}</Text>
      {head !== '' && <Text dimColor>{head}</Text>}
    </Box>
  )
}

function briefView(ui: UI, p: PanelView, g: PanelGraph, cols: number) {
  const { Box, Text } = ui
  const sec = sections(p.brief)
  const progress = sec.get('Progress')?.lines ?? []
  const idW = Math.max(4, ...g.lanes.map(l => l.id.length)) + 2
  const cntW = Math.max(5, ...g.lanes.map(l => `${l.done}/${l.total}`.length)) + 2
  const sqW = Math.min(Math.max(1, ...g.lanes.map(l => l.slices.length)), Math.max(8, cols - idW - cntW - 18)) + 2
  // what follows the squares: the milestone's ETA, or for a human or queue lane the brief's own words
  const tail = (l: PanelLane) => (l.block ? (progress.find(x => x.startsWith(`${l.id} `))?.replace(/^\S+\s+\d+\/\d+\s+/, '') ?? '') : l.eta)
  const marks = (l: PanelLane) => {
    const runs: { state: SliceState; n: number }[] = []
    for (const id of l.slices.filter(x => g.slices[x]).slice(0, sqW - 2)) {
      const state = g.slices[id]?.state ?? 'waiting'
      const last = runs.at(-1)
      if (last?.state === state) last.n += 1
      else runs.push({ state, n: 1 })
    }
    return { runs, n: runs.reduce((k, r) => k + r.n, 0) }
  }
  const finished = progress.find(x => x.includes('every slice done'))
  const used = new Set(Object.values(g.slices).map(s => s.state))

  const running = Object.entries(g.slices).filter(([, s]) => s.state === 'running')
    .sort(([, a], [, b]) => (a.started ?? '').localeCompare(b.started ?? ''))
  const slW = Math.max(7, ...running.map(([id]) => id.length + 2)) + 2
  const helperRow = (cells: string[], title: string, header: boolean, id = '') => (
    <Box flexDirection="row">
      {id !== '' ? <Text mono color={STATE.running.color}>{`▶ ${id}`.padEnd(slW)}</Text> : <Text mono dimColor>{(cells[0] ?? '').padEnd(slW)}</Text>}
      <Text mono {...(header ? { dimColor: true } : {})}>{(cells[1] ?? '').padEnd(8)}</Text>
      <Text mono dimColor>{(cells[2] ?? '').padEnd(9)}</Text>
      <Text mono {...(header ? { dimColor: true } : {})}>{(cells[3] ?? '').padEnd(9)}</Text>
      <Text mono {...(header ? { dimColor: true } : {})}>{(cells[4] ?? '').padEnd(9)}</Text>
      <Box flexShrink={1}><Text wrap="truncate-end" {...(header ? { dimColor: true } : {})}>{title}</Text></Box>
    </Box>
  )

  const L = 9
  const n = Math.max(10, Math.min(30, cols - L - 24))
  const etaColor = (t: string) => (t === 'waits on you' ? { color: STATE.you.color } : t.startsWith('≈') ? {} : { dimColor: true })

  return (
    <Box flexDirection="column" gap={1}>
      <Text dimColor>{p.brief.split('\n')[0] ?? ''}</Text>

      <Box flexDirection="column">
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          <Text bold>Progress</Text>
          {(Object.keys(STATE) as SliceState[]).filter(k => used.has(k)).map(k => <Text color={STATE[k].color}>{`${STATE[k].mark} ${STATE[k].label}`}</Text>)}
        </Box>
        {finished && (
          <Box flexDirection="row">
            <Text mono color={STATE.done.color}>{'✓'.padEnd(idW)}</Text>
            <Text dimColor>{finished}</Text>
          </Box>
        )}
        {g.lanes.map(l => {
          const m = marks(l)
          const t = tail(l)
          return (
            <Box flexDirection="row">
              <Text mono bold>{l.id.padEnd(idW)}</Text>
              <Text mono dimColor>{`${l.done}/${l.total}`.padEnd(cntW)}</Text>
              {m.runs.map(r => <Text mono color={STATE[r.state].color}>{STATE[r.state].mark.repeat(r.n)}</Text>)}
              <Text mono>{' '.repeat(Math.max(1, sqW - m.n))}</Text>
              <Box flexShrink={1}><Text wrap="truncate-end" {...etaColor(t)}>{t}</Text></Box>
            </Box>
          )
        })}
      </Box>

      <Box flexDirection="column">
        {heading(ui, 'Helpers', sec.get('Helpers')?.head)}
        {running.length > 0 && helperRow(['Slice', 'Model', 'Started', 'Running', 'ETA'], 'Title', true)}
        {running.map(([id, s]) => helperRow(['', s.model ?? '', s.started ?? '', s.minutes != null ? `${s.minutes} min` : '', s.eta ? `≈ ${s.eta}` : ''], s.title, false, id))}
      </Box>

      {chatsView(ui, p.chats ?? [])}

      {p.windows && (p.windows.five || p.windows.week)
        ? windowsView(ui, p.windows, n, L, 'Usage')
        : sec.get('Usage') && (
          <Box flexDirection="column">
            {heading(ui, 'Usage')}
            {sec.get('Usage')?.lines.map(x => <Text dimColor>{x}</Text>)}
          </Box>
        )}

      {(['Pace', 'Waits for you', 'Could start now'] as const).map(name => {
        const s = sec.get(name)
        if (!s) return null
        return (
          <Box flexDirection="column">
            {heading(ui, name, s.head)}
            {s.lines.map((x, i) => sliceText(ui, g, x, name === 'Pace' && i > 0 ? { dimColor: true } : {}))}
          </Box>
        )
      })}
    </Box>
  )
}

// the chats working in the project now, outside the roadmap: for information only
function chatsView(ui: UI, chats: PanelView['chats']) {
  const { Box, Text } = ui
  if (!chats.length) return null
  return (
    <Box flexDirection="column">
      {heading(ui, 'Chats computing', 'outside the roadmap, for information')}
      {chats.map(c => (
        <Box flexDirection="row">
          <Text mono color="claude">{'◐ '}</Text>
          <Box flexShrink={1}><Text wrap="truncate-end">{c.title}</Text></Box>
          {c.at !== '' && <Text mono dimColor>{`  active ${c.at}`}</Text>}
        </Box>
      ))}
    </Box>
  )
}

// ---------- the graph: one row of slices per milestone, each number in the colour of its state; hover a slice for
// its line, press a milestone for its slices and a slice there (or in a chip row) for its card ----------

function graphView(ui: UI, p: PanelView, g: PanelGraph, act: Act) {
  const { Box, Text, Button } = ui
  const pick = (id: string) => act(q => ({ ...q, selected: q.selected === id ? '' : id }))
  const lanes = [...(p.showFinished ? g.finished : []), ...g.lanes]
  const ids = lanes.flatMap(l => l.slices).filter(id => g.slices[id])
  const of = (state: SliceState) => Object.entries(g.slices).filter(([, s]) => s.state === state).map(([id]) => id)
  const sel = p.selected
  const selSlice = g.slices[sel] as PanelSlice | undefined
  const selLane = [...g.lanes, ...g.finished].find(l => l.id === sel)

  // plain Text, not a Button: a desktop draws a Button natively and drops the colour of the Text inside it
  const cell = (id: string) => {
    const s = g.slices[id]
    if (!s) return null
    const linked = !!selSlice && (selSlice.after.includes(id) || s.after.includes(sel))
    const label = `${(id.split('.')[1] ?? id).replace(/^tidy(\d*)$/, 't$1').padStart(2)} `
    return (
      <Box hover={{ scope: `g:${id}` }}>
        <Text mono color={STATE[s.state].color} bold={s.state !== 'waiting'} hover={{ scope: `g:${id}`, inverse: true }}
          {...(id === sel ? { inverse: true } : {})} {...(linked ? { underline: true } : {})}>{label}</Text>
      </Box>
    )
  }
  const laneRow = (l: PanelLane) => (
    <Box flexDirection="row" gap={1}>
      <Button key={`l:${l.id}`} plain onPress={pick(l.id)}><Text mono bold {...(l.id === sel ? { inverse: true } : {})}>{l.id.padEnd(4)}</Text></Button>
      <Text mono dimColor>{`${l.done}/${l.total}`.padEnd(6)}</Text>
      <Box flexDirection="row" flexWrap="wrap" flexShrink={1}>{l.slices.filter(id => g.slices[id]).map(cell)}</Box>
      {l.eta !== '' && <Text dimColor>{l.eta}</Text>}
    </Box>
  )
  // the coloured mark beside the Button, for the same reason
  const chips = (where: string, list: string[]) => list.map(id => (
    <Box flexDirection="row">
      <Text color={STATE[g.slices[id]?.state ?? 'waiting'].color}>{`${STATE[g.slices[id]?.state ?? 'waiting'].mark} `}</Text>
      <Button key={`${where}:${id}`} plain onPress={pick(id)}>{id}</Button>
    </Box>
  ))
  const chipRow = (label: string, where: string, list: string[]) => list.length > 0 && (
    <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
      <Text dimColor>{label}</Text>
      {chips(where, list)}
    </Box>
  )

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Text>{g.mode}</Text>
        {g.allDone && <Text bold>{`all done ≈ ${g.allDone}`}</Text>}
      </Box>
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        {(Object.keys(STATE) as SliceState[]).map(k => <Text color={STATE[k].color}>{`${STATE[k].mark} ${STATE[k].label}`}</Text>)}
      </Box>
      <Box flexDirection="column">
        {lanes.map(laneRow)}
        {g.finished.length > 0 && (
          <Box flexDirection="row" marginTop={1}>
            <Button key="finished" dimColor onPress={act(q => ({ ...q, showFinished: !q.showFinished }))}>
              {p.showFinished ? 'Hide the finished milestones' : `Show the ${g.finished.length} finished milestones`}
            </Button>
          </Box>
        )}
        {ids.map(id => (
          <Box display="none" hover={{ scope: `g:${id}`, display: 'flex' }}>
            <Text wrap="truncate-end">{`${id} · ${g.slices[id]?.title ?? ''} · ${stateLine(g, id)}`}</Text>
          </Box>
        ))}
      </Box>
      {selSlice && sliceCard(ui, g, sel, act, chips)}
      {!selSlice && selLane && laneCard(ui, g, selLane, act, pick)}
      {chipRow('Running', 'run', of('running'))}
      {(p.chats ?? []).length > 0 && (
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          <Text dimColor>Chats computing</Text>
          {(p.chats ?? []).map(c => <Text><Text color="claude">◐ </Text>{c.title}</Text>)}
        </Box>
      )}
      {chipRow('Could start now', 'ready', of('ready'))}
      {chipRow('For you', 'you', of('you').filter(id => !g.finished.some(l => l.slices.includes(id))))}
      {g.pace && <Text dimColor>{g.pace}</Text>}
    </Box>
  )
}

// what a slice is doing, in one line
function stateLine(g: PanelGraph, id: string): string {
  const s = g.slices[id]
  if (!s) return ''
  const eta = s.eta ? ` · ETA ≈ ${s.eta}` : ''
  if (s.state === 'done') return 'done'
  if (s.state === 'running') return `running since ${s.started ?? '?'} (${s.minutes ?? '?'} min)${eta}`
  if (s.state === 'ready') return `could start now${eta}`
  if (s.state === 'you') return s.question ? `waits on your answer: ${s.question}` : 'waits on you'
  const open = s.after.filter(a => g.slices[a] && g.slices[a].state !== 'done')
  return `${open.length ? `waits on ${open.join(', ')}` : 'waits for a helper'}${eta}`
}

function sliceCard(ui: UI, g: PanelGraph, id: string, act: Act, chips: (where: string, list: string[]) => RenderElement[]) {
  const { Box, Text, Button } = ui
  const s = g.slices[id]
  if (!s) return null
  const unblocks = Object.entries(g.slices).filter(([, x]) => x.after.includes(id)).map(([k]) => k)
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>{`${id} · ${s.title}`}</Text>
      <Text color={STATE[s.state].color}>{stateLine(g, id)}</Text>
      {s.branch && <Text dimColor>{`on ${s.branch}`}</Text>}
      <Text dimColor>{[s.ms, s.model, s.opus ? 'an Opus slice, the costly ones' : ''].filter(Boolean).join(' · ')}</Text>
      {s.after.length > 0 && <Box flexDirection="row" flexWrap="wrap" columnGap={1}><Text dimColor>needs</Text>{chips('needs', s.after.filter(a => g.slices[a]))}</Box>}
      {unblocks.length > 0 && <Box flexDirection="row" flexWrap="wrap" columnGap={1}><Text dimColor>unblocks</Text>{chips('unblocks', unblocks)}</Box>}
      <Box flexDirection="row"><Button key="close-card" dimColor onPress={act(q => ({ ...q, selected: '' }))}>Close</Button></Box>
    </Box>
  )
}

// a milestone's card: its counts, then one row per slice (mark, id to press for the slice's card, title, state)
function laneCard(ui: UI, g: PanelGraph, l: PanelLane, act: Act, pick: (id: string) => () => void) {
  const { Box, Text, Button } = ui
  const count = (state: SliceState) => l.slices.filter(id => g.slices[id]?.state === state).length
  const w = Math.max(4, ...l.slices.map(id => id.length)) + 1
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>{`${l.id} · ${l.title}`}</Text>
      <Text>{`${l.done} of ${l.total} done${l.eta ? ` · ${l.eta}` : ''}`}</Text>
      <Text dimColor>{(['running', 'ready', 'you', 'waiting'] as const).filter(k => count(k)).map(k => `${count(k)} ${STATE[k].label}`).join(' · ') || 'every slice done'}</Text>
      <Box flexDirection="column" marginTop={1}>
        {l.slices.filter(id => g.slices[id]).map(id => {
          const s = g.slices[id]!
          return (
            <Box flexDirection="row" columnGap={1}>
              <Text color={STATE[s.state].color}>{STATE[s.state].mark}</Text>
              <Button key={`s:${id}`} plain onPress={pick(id)}>{id.padEnd(w)}</Button>
              <Box flexShrink={1}><Text wrap="truncate-end">{s.title}</Text></Box>
              <Text color={STATE[s.state].color}>{s.state === 'running' && s.eta ? `≈ ${s.eta}` : s.state === 'done' ? '' : STATE[s.state].label}</Text>
            </Box>
          )
        })}
      </Box>
      <Box flexDirection="row"><Button key="close-card" dimColor onPress={act(q => ({ ...q, selected: '' }))}>Close</Button></Box>
    </Box>
  )
}

// ---------- usage: the plan windows, then the tiles and the six charts of the stareso-usage skill ----------

const KIND: Record<string, string> = {
  build: 'suggestion', test: 'success', improve: 'claude', chat: 'warning', 'status & retro': 'inactive', status: 'inactive', retro: 'inactive', usage: 'inactive',
}
const TIER: Record<string, string> = { light: 'success', standard: 'suggestion', strong: 'claude' }
const BUILT: Record<string, string> = { helpers: 'suggestion', chat: 'warning' }
const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']

function fmt(n: number | null | undefined): string {
  return n == null || isNaN(n) ? 'n/a' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n))
}

// a bar of `cells` cells at most, to the eighth of a cell
function bar(v: number, max: number, cells: number): string {
  const e = max > 0 ? Math.round((Math.max(0, v) / max) * cells * 8) : 0
  const s = '█'.repeat(Math.floor(e / 8)) + EIGHTHS[e % 8]
  return v > 0 && !s ? '▏' : s
}

// the rest of a track after `used` cells, with a ┆ at each mark the bar has not reached
function rest(used: number, cells: number, marks: number[] = []): string {
  return Array.from({ length: Math.max(0, cells - used) }, (_, i) => (marks.includes(used + i) ? '┆' : ' ')).join('')
}

function usageView(ui: UI, p: PanelView, cols: number, act: Act) {
  const { Box, Text, Button, Markdown } = ui
  const c = p.usage
  const L = 9, V = 22
  const n = Math.max(12, cols - L - V - 4)
  return (
    <Box flexDirection="column" gap={1}>
      {windowsView(ui, p.windows, n, L)}
      {p.usageError !== '' && <Text color="error">{p.usageError}</Text>}
      {!c && p.usageError === '' && <Text dimColor>reading the usage report… (a few seconds)</Text>}
      {c && (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>{`read ${clock(p.usageAt)}, from the transcripts as they are now · ${c.unit}`}</Text>
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
            {c.tiles.map(t => (
              <Box flexDirection="column" borderStyle="round" paddingX={1}>
                <Text dimColor size="caption">{t.label}</Text>
                <Text bold size="heading">{t.value}</Text>
              </Box>
            ))}
          </Box>
          {chart(ui, '1. Share of the workflow cost by step type', 'Where the tokens go: build should lead; a large chat bar is work done outside the steps.',
            c.shareByType.map((t, i) => ({
              scope: `u1:${i}`, label: t.type, segs: [{ text: bar(t.share, Math.max(...c.shareByType.map(x => x.share)), n), color: KIND[t.type] ?? 'inactive' }],
              value: `${t.share} % · ${fmt(t.equiv)}`, detail: `${t.type}: ${fmt(t.equiv)} ≈ equiv, ${t.hours.toFixed(1)} h active, ${t.turns} turns`,
            })), L, n)}
          {cumulativeChart(ui, c, n, L)}
          {milestoneChart(ui, c, n, L)}
          {sessionChart(ui, c, n, L)}
          {scatterChart(ui, c, cols)}
          {chart(ui, '6. Conductor against helpers, per step that merged slices', 'A launched build should be mostly helpers; a bar all conductor is a chat or a test that built itself.',
            c.conductorVsHelpers.filter(b => b.conductor != null || b.helpers != null).map((b, i, all) => {
              const max = Math.max(...all.map(x => (x.conductor ?? 0) + (x.helpers ?? 0)))
              const cs = bar(b.conductor ?? 0, max, n)
              const hs = bar(b.helpers ?? 0, max, n)
              const total = (b.conductor ?? 0) + (b.helpers ?? 0)
              return {
                scope: `u6:${i}`, label: `#${b.session}`, segs: [{ text: cs, color: 'warning' }, { text: hs, color: 'suggestion' }],
                value: `${b.merged} slices · ${total ? Math.round((100 * (b.conductor ?? 0)) / total) : 0} %`,
                detail: `#${b.session} ${b.type} ${b.date}: conductor ${fmt(b.conductor)}, helpers ${fmt(b.helpers)} (${b.helperCount} helpers), ${b.merged} slices merged`,
              }
            }), L, n, [{ text: '█ conductor', color: 'warning' }, { text: '█ helpers', color: 'suggestion' }, { text: 'value: slices merged · conductor share (target under 50 %)' }])}
          <Box flexDirection="row">
            <Button key="tables" dimColor onPress={act(q => ({ ...q, showTables: !q.showTables }))}>{p.showTables ? 'Hide the tables' : 'Show the tables'}</Button>
          </Box>
          {p.showTables && p.usageMd !== '' && <Markdown text={p.usageMd} />}
        </Box>
      )}
    </Box>
  )
}

type Row = { scope: string; label: string; segs: Seg[]; value: string; detail: string; marks?: number[]; valueColor?: string }

// one chart of horizontal bars: label, bar (segments), value; hovering a row reveals its detail line under the chart
function chart(ui: UI, title: string, caption: string, rows: Row[], L: number, n: number, legend: Seg[] = []) {
  const { Box, Text } = ui
  if (!rows.length) return null
  return (
    <Box flexDirection="column">
      <Text bold>{title}</Text>
      <Text dimColor>{caption}</Text>
      {rows.map(r => {
        const used = r.segs.reduce((k, s) => k + s.text.length, 0)
        return (
          <Box flexDirection="row" hover={{ scope: r.scope }}>
            <Text mono hover={{ scope: r.scope, underline: true }}>{r.label.slice(0, L).padEnd(L)}</Text>
            {r.segs.filter(s => s.text !== '').map(s => <Text mono {...(s.color ? { color: s.color } : {})}>{s.text}</Text>)}
            <Text mono dimColor>{rest(used, n, r.marks)}</Text>
            <Text mono {...(r.valueColor ? { color: r.valueColor } : { dimColor: true })}>{` ${r.value}`}</Text>
          </Box>
        )
      })}
      {legend.length > 0 && (
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          {legend.map(s => <Text {...(s.color ? { color: s.color } : { dimColor: true })}>{s.text}</Text>)}
        </Box>
      )}
      {rows.map(r => <Box display="none" hover={{ scope: r.scope, display: 'flex' }}><Text>{r.detail}</Text></Box>)}
    </Box>
  )
}

// the plan's 5-hour and weekly windows from the minute reads, with the stop caps as ┆ marks
function windowsView(ui: UI, windows: PanelView['windows'], n: number, L: number, title = 'Plan usage now') {
  const { Box, Text } = ui
  const rows = ([['5-hour', windows?.five], ['weekly', windows?.week]] as const).filter(([, w]) => w)
  if (!rows.length) return null
  return (
    <Box flexDirection="column">
      <Text bold>{title}</Text>
      {rows.map(([name, w]) => {
        const win = w!
        const used = bar(win.pct, 100, n)
        const marks = win.reach.map(r => Math.round((r.cap / 100) * n))
        // red at a cap, amber within 10 points of one
        const level = win.reach.some(r => r.at === 'reached' || win.pct >= r.cap) ? 'error' : win.reach.some(r => win.pct >= r.cap - 10) ? 'warning' : ''
        return (
          <Box flexDirection="column">
            <Box flexDirection="row">
              <Text mono>{name.padEnd(L)}</Text>
              <Text mono color={level || 'suggestion'}>{used}</Text>
              <Text mono dimColor>{rest(used.length, n, marks)}</Text>
              <Text mono bold {...(level ? { color: level } : {})}>{`${String(win.pct).padStart(4)} %`}</Text>
              {win.ratePerHour != null && <Text mono dimColor>{`  +${win.ratePerHour} %/h`}</Text>}
            </Box>
            <Box marginLeft={L} flexDirection="column">
              {win.reach.map(r => (
                <Text dimColor>{`${r.name} cap ${r.cap} % · ${r.at === 'reached' ? 'reached' : r.at ? `at about ${r.at}` : 'not before the reset'}`}</Text>
              ))}
              <Text dimColor>{`resets ${win.resets}`}</Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

// 2. the running total of each step type at the end of each day, stacked (the stacked variant of the skill's chart 2)
function cumulativeChart(ui: UI, c: UsageCharts, n: number, L: number) {
  const pts = [...c.cumulative.points].sort((a, b) => a.day - b.day)
  if (!pts.length) return null
  const total = (q: { [key: string]: number }) => c.cumulative.kinds.reduce((k, kind) => k + (q[kind] ?? 0), 0)
  const max = Math.max(...pts.map(total))
  // the tool's days run to the day after the last step: stop at today
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const days = c.cumulative.days.filter(d => d.date <= iso).map(d => ({ d, q: [...pts].reverse().find(q => q.day < d.day + 1) })).filter(x => x.q).slice(-14)
  const rows: Row[] = days.map(({ d, q }, i) => {
    const segs = c.cumulative.kinds.map(kind => ({ text: '█'.repeat(Math.round(((q![kind] ?? 0) / max) * n)), color: KIND[kind] ?? 'inactive' }))
    return {
      scope: `u2:${i}`, label: d.date.slice(5), segs, value: `${total(q!).toFixed(1)}M`,
      detail: `${d.date}, total so far: ${c.cumulative.kinds.map(k => `${k} ${(q![k] ?? 0).toFixed(1)}M`).join(' · ')}`,
    }
  })
  return chart(ui, '2. Cumulative cost by step type, at the end of each day', 'A row that grows a lot is a day of big steps; the colours show which type made it (≈ equiv, millions).',
    rows, L, n, c.cumulative.kinds.map(k => ({ text: `█ ${k}`, color: KIND[k] ?? 'inactive' })))
}

// 3. cost per slice by milestone, coloured by who built it, with the reference slice cost as a ┆ mark
function milestoneChart(ui: UI, c: UsageCharts, n: number, L: number) {
  const ref = c.referencePerSlice?.equiv ?? 0
  const max = Math.max(ref, ...c.milestones.map(m => m.equivPerSlice ?? 0))
  const mark = ref ? [Math.round((ref / max) * n)] : []
  // the reference as a row of its own too: the ┆ mark hides under bars that pass it
  const refRow: Row[] = ref ? [{
    scope: 'u3:ref', label: 'ref', segs: [{ text: bar(ref, max, n), color: 'inactive' }], value: fmt(ref),
    detail: `reference: ${c.referencePerSlice!.label}, ${fmt(ref)} per slice`,
  }] : []
  const rows: Row[] = c.milestones.map((m, i) => ({
    scope: `u3:${i}`, label: m.id, segs: [{ text: m.equivPerSlice == null ? '' : bar(m.equivPerSlice, max, n), color: BUILT[m.built] ?? 'claude' }],
    value: m.equivPerSlice == null ? 'no transcript' : fmt(m.equivPerSlice), marks: mark,
    detail: `${m.id}: ${fmt(m.equivPerSlice)} per slice, built by ${m.built}, measured ${m.measured}, ${m.slices} slices`,
  }))
  return chart(ui, '3. Cost per slice by milestone', 'Launched builds should sit near the reference; chat-built milestones sit far above it.', [...refRow, ...rows], L, n,
    [{ text: '█ helpers', color: 'suggestion' }, { text: '█ chat', color: 'warning' }, { text: '█ mixed', color: 'claude' },
      ...(ref ? [{ text: `ref: ${c.referencePerSlice!.label}` }] : [])])
}

// 4. context per turn by session (cache read ÷ turns), red past 300 turns, with the base of a launched session marked
function sessionChart(ui: UI, c: UsageCharts, n: number, L: number) {
  const list = c.sessions.filter(s => s.ctx != null).slice(-30)
  const BASE = 100e3
  const max = Math.max(BASE, ...list.map(s => s.ctx ?? 0))
  const baseRow: Row = { scope: 'u4:base', label: 'base', segs: [{ text: bar(BASE, max, n), color: 'inactive' }], value: fmt(BASE), detail: 'a launched session re-reads about 100k per turn' }
  const rows: Row[] = [baseRow, ...list.map((s, i) => ({
    scope: `u4:${i}`, label: `#${s.n}`, segs: [{ text: bar(s.ctx ?? 0, max, n), color: s.over300 ? 'error' : 'suggestion' }],
    value: `${fmt(s.ctx)} · ${s.turns} turns`, marks: [Math.round((BASE / max) * n)], ...(s.over300 ? { valueColor: 'error' } : {}),
    detail: `#${s.n} ${s.date}: ${fmt(s.ctx)} re-read per turn, ${s.turns} turns, ${fmt(s.equiv)} ≈ equiv, ${s.helpers} helpers${s.over300 ? ': should have been split' : ''}`,
  }))]
  return chart(ui, '4. Context per turn by session', 'Launched sessions sit near the base; long mixed sessions climb past 200k. Red: over 300 turns.', rows, L, n,
    [{ text: 'base: a launched session, 100k' }, { text: '█ over 300 turns', color: 'error' }])
}

// 5. helper tokens against lines changed, one point per slice, both scales logarithmic; hover a point for its slices
function scatterChart(ui: UI, c: UsageCharts, cols: number) {
  const { Box, Text } = ui
  const pts = c.slices.filter(s => s.tokens > 0 && s.lines > 0)
  if (!pts.length) return null
  const W = Math.max(24, Math.min(80, cols - 10)), H = 10
  const lx = pts.map(s => Math.log10(s.lines)), ly = pts.map(s => Math.log10(s.tokens))
  const [x0, x1, y0, y1] = [Math.min(...lx), Math.max(...lx), Math.min(...ly), Math.max(...ly)]
  const xi = (v: number) => Math.min(W - 1, Math.max(0, x1 > x0 ? Math.round(((Math.log10(v) - x0) / (x1 - x0)) * (W - 1)) : 0))
  const yi = (v: number) => H - 1 - Math.min(H - 1, Math.max(0, y1 > y0 ? Math.round(((Math.log10(v) - y0) / (y1 - y0)) * (H - 1)) : 0))
  type Cell = { list: typeof pts; median?: string }
  const grid = new Map<string, Cell>()
  for (const s of pts) {
    const k = `${xi(s.lines)},${yi(s.tokens)}`
    grid.set(k, { list: [...(grid.get(k)?.list ?? []), s] })
  }
  for (const m of c.tierMedians) {
    if (m.tokens == null || m.lines == null) continue
    const k = `${xi(m.lines)},${yi(m.tokens)}`
    if (!grid.has(k)) grid.set(k, { list: [], median: m.tier })
  }
  const glyph = (cell: Cell): Seg => cell.median ? { text: '+', color: TIER[cell.median] ?? 'inactive' }
    : cell.list.some(s => s.outlier) ? { text: '◉', color: 'error' } : { text: cell.list.length > 1 ? '◆' : '●', color: TIER[cell.list[0]?.tier ?? ''] ?? 'inactive' }
  const yLabel = (y: number) => (y === 0 ? fmt(10 ** y1) : y === H - 1 ? fmt(10 ** y0) : '').padStart(6)
  const rows = Array.from({ length: H }, (_, y) => {
    const out: RenderElement[] = []
    let blank = ''
    for (let x = 0; x < W; x++) {
      const cell = grid.get(`${x},${y}`)
      if (!cell) { blank += ' '; continue }
      if (blank) { out.push(<Text mono>{blank}</Text>); blank = '' }
      const g = glyph(cell)
      out.push(<Text mono color={g.color!} hover={{ scope: `u5:${x},${y}`, inverse: true }}>{g.text}</Text>)
    }
    if (blank) out.push(<Text mono>{blank}</Text>)
    return <Box flexDirection="row"><Text mono dimColor>{`${yLabel(y)} │`}</Text>{out}</Box>
  })
  const cells = [...grid.entries()]
  const minL = Math.round(10 ** x0), maxL = Math.round(10 ** x1)
  return (
    <Box flexDirection="column">
      <Text bold>5. Helper tokens against lines changed, one point per slice</Text>
      <Text dimColor>Both scales logarithmic. Compare a point with its own tier's cloud, never across tiers; a ringed point cost over twice its tier's median.</Text>
      {rows}
      <Text mono dimColor>{`${' '.repeat(6)} └${'─'.repeat(W)}`}</Text>
      <Text mono dimColor>{`${' '.repeat(8)}${`${minL} lines`.padEnd(Math.max(0, W - String(maxL).length - 6))}${maxL} lines`}</Text>
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        {c.tierMedians.map(m => <Text color={TIER[m.tier] ?? 'inactive'}>{`● ${m.tier} (${m.model}) median ${fmt(m.tokens)} · ${m.lines ?? 'n/a'} lines · ${fmt(m.per100)} per 100 lines`}</Text>)}
        <Text color="error">◉ over twice its tier median</Text>
        <Text dimColor>◆ several slices · + a tier median</Text>
      </Box>
      {cells.map(([k, cell]) => (
        <Box display="none" hover={{ scope: `u5:${k}`, display: 'flex' }}>
          <Text>{cell.median ? `${cell.median} median` : cell.list.slice(0, 4).map(s => `${s.id} ${s.tier} ${fmt(s.tokens)} tokens, ${s.lines} lines${s.outlier ? ' (outlier)' : ''}`).join(' · ') + (cell.list.length > 4 ? ` · ${cell.list.length - 4} more` : '')}</Text>
        </Box>
      ))}
    </Box>
  )
}

// minutes from now to "HH:MM" (today, or tomorrow when it is earlier than now)
function minutesUntil(hhmm: string): number {
  const m = /^(\d\d):(\d\d)/.exec(hhmm)
  if (!m) return Infinity
  const d = new Date()
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(m[1]), Number(m[2]))
  let diff = (t.getTime() - d.getTime()) / 60000
  if (/tomorrow/.test(hhmm) || diff < -60) diff += 24 * 60
  return diff
}
