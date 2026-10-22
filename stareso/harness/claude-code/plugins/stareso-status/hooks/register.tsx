// Live stareso status: a pane beside the chat that runs ~/.claude/stareso/tools/progress-graph.mjs every minute while
// it is open and draws its progress (the brief's context, one row of slices per milestone in the colour of their
// state to hover and press, the running helpers, the chats computing in the project, the pace, what waits) or the
// project's usage (the plan windows, then the tiles and six charts of the usage report (metrics.md) from usage-report.mjs
// --live), with toasts when a slice merges, a helper starts, a helper runs past twice the usual slice time, or a usage
// cap comes within 15 minutes. Everything is drawn with the surface's own elements, so the terminal draws it too.
// No model call: only the tools, git and the app's own usage reading.
//
//   /stareso-panel                 opens the panel, or hides it when it is open
//   /stareso-panel <folder>        opens it on that project (remembered across sessions)
//   /stareso-panel progress | usage   opens it on that view (graph and brief open Progress)
import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register, RenderElement } from 'claude-code'

import type { EtaTrack, PanelGraph, PanelLane, PanelSlice, PanelView, SliceState, UsageCharts, UsageWindow } from '../types'

const PANE = 'stareso-status'
const TITLE = 'stareso status'
const EVERY_MS = 60_000
// the usage report (a few seconds) is read again while its view is open once it is older than this, or a slice merged
const USAGE_STALE_MS = 5 * 60_000
const WIDE = 110
// the project's chats listed in Progress: those idle for less than a day, at most this many
const CHATS_RECENT_MS = 24 * 3600_000
const MAX_CHATS = 8
const EMPTY: PanelView = {
  project: '', root: '', brief: '', graph: null, windows: null, updated: '', error: '', view: 'graph', selected: '',
  showFinished: false, usageNote: '', usage: null, usageMd: '', usageAt: 0, usageMerge: '', usageError: '', showTables: false, allSessions: false, chats: [],
  etaTrack: null, expanded: [],
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
  etaTrack?: EtaTrack
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

// The app's chats in the project folder or below it (its worktrees), and the chats started from them wherever they run,
// working or idle, those idle for over a day left out, from the app's own session list; none when the app does not
// give it. The chat the panel draws in is added from `get_session self`, since the app leaves it out of its own list.
// A chat is active when it works, when a step it launched works (a manager waiting on its build), or when it is the
// build and helpers run (a conductor waiting on its helpers).
type ChatRow = { sessionId?: string; startedBy?: string; parentSessionId?: string; name?: string; title?: string; cwd?: string; isRunning?: boolean; lastActivityAt?: string }
async function projectChats($: EngineInterface, root: string, helpersRunning: boolean): Promise<PanelView['chats']> {
  const norm = (f: string) => f.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  const textOf = (res: { content: { type: string }[] }) => (res.content.find(c => c.type === 'text') as { text?: string } | undefined)?.text ?? ''
  try {
    const res = await $.mcp.call('ccd_session_mgmt', 'list_sessions', { limit: 40 })
    const rows = JSON.parse(textOf(res) || '[]') as ChatRow[]
    const r = norm(root)
    const since = Date.now() - CHATS_RECENT_MS
    const list = Array.isArray(rows) ? [...rows] : []
    let selfId = ''
    try {
      const self = JSON.parse(textOf(await $.mcp.call('ccd_session_mgmt', 'get_session', { session_id: 'self' })) || 'null') as ChatRow | null
      if (self?.sessionId) {
        selfId = self.sessionId
        list.unshift({ ...self, startedBy: self.parentSessionId })
      }
    } catch {
      // no self: the list alone
    }
    // a chat in the project's folder, or one started from such a chat (a side chat often runs elsewhere, ~/.claude say)
    const inProject = (x: (typeof list)[number]) => !!x.cwd && (norm(x.cwd) === r || norm(x.cwd).startsWith(`${r}/`))
    const ids = new Set(list.filter(inProject).flatMap(x => (x.sessionId ? [x.sessionId] : [])))
    // the app leaves the panel's own chat out of the list, which breaks the chain through it: its own family (the chat
    // that started it, the ones it started) joins whole when one of them works in the project
    try {
      const fam = await $.mcp.call('ccd_session_mgmt', 'list_sessions', { linked: true, limit: 40 })
      const famText = (fam.content.find(c => c.type === 'text') as { text?: string } | undefined)?.text ?? '[]'
      const family = JSON.parse(famText) as typeof list
      if (Array.isArray(family) && family.some(inProject)) for (const x of family) if (x.sessionId) ids.add(x.sessionId)
    } catch {
      // no family list: the folder and the chains in the list above
    }
    for (let grew = true; grew;) {
      grew = false
      for (const x of list) {
        if (x.sessionId && !ids.has(x.sessionId) && x.startedBy && ids.has(x.startedBy)) {
          ids.add(x.sessionId)
          grew = true
        }
      }
    }
    // a chat with a working descendant (a step it launched, or one launched from that) counts as active
    const launchedWorking = (id: string, seen = new Set<string>()): boolean => list.some(x => {
      if (x.startedBy !== id || !x.sessionId || seen.has(x.sessionId)) return false
      seen.add(x.sessionId)
      return !!x.isRunning || launchedWorking(x.sessionId, seen)
    })
    const why = (x: ChatRow): PanelView['chats'][number]['why'] => (x.isRunning ? 'working'
      : x.sessionId && launchedWorking(x.sessionId) ? 'launched'
      : helpersRunning && /build/i.test(`${x.name ?? ''} ${x.title ?? ''}`) ? 'helpers' : undefined)
    return list
      .filter(x => inProject(x) || (!!x.sessionId && ids.has(x.sessionId)))
      .map(x => ({ x, why: why(x) }))
      .filter(({ x, why: w }) => !!w || x.sessionId === selfId || !x.lastActivityAt || Date.parse(x.lastActivityAt) >= since)
      .map(({ x, why: w }) => ({
        title: x.title || 'untitled chat', at: x.lastActivityAt ? clock(Date.parse(x.lastActivityAt)) : '', working: !!w,
        ...(w ? { why: w } : {}), ...(x.sessionId === selfId ? { here: true } : {}),
      }))
      // the active ones first; the list comes most recent first
      .sort((a, b) => Number(b.working) - Number(a.working))
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
    const chats = await projectChats($, s.root, s.running.length > 0)
    await update($, panel, p => ({
      ...p, project: s.project, root: s.root, brief: s.brief, graph: s.graph, windows: s.usage, etaTrack: s.etaTrack ?? null, chats, updated: clock(), error: '',
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

// Opens the panel (the command, or the stareso button in the prompt footer): the minute timer, a read, the view
async function openPanel($: EngineInterface, view?: PanelView['view']) {
  startTicking($)
  await refresh($)
  await show($, view ?? (await read($, panel)).view)
}

async function show($: EngineInterface, view: PanelView['view']) {
  await update($, panel, p => ({ ...p, view }))
  // the usage charts want a wide dock (Progress is laid out for a narrow one); a width the person dragged wins
  await $.ui.open({ id: PANE, title: TITLE, ...(view === 'usage' ? { columns: WIDE } : {}) })
  if (view === 'usage' && usageDue(await panelState($))) await readUsage($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'stareso-panel',
      description: 'Live stareso status beside the chat: opens or hides it (optional: a project folder, progress or usage)',
      argumentHint: '[project folder | progress | usage]',
    })

    return next(e)
  })

  on('command.run', { command: 'stareso-panel' }, async ($, e) => {
    const arg = (e.args ?? '').trim().replace(/^"|"$/g, '')
    const views: Record<string, PanelView['view']> = { progress: 'graph', graph: 'graph', brief: 'graph', text: 'graph', usage: 'usage' }
    if (!arg && (await isOpen($))) {
      await $.ui.close({ id: PANE })
      return { text: 'stareso panel hidden: /stareso-panel shows it again.' }
    }
    if (arg && !views[arg]) {
      await $.store.set('project', arg)
      await update($, panel, p => ({ ...p, root: arg, selected: '', usage: null, usageMd: '', usageAt: 0, usageError: '' }))
      seen = null
    }
    await openPanel($, views[arg])
    const p = await panelState($)

    return { text: p.error ? `stareso panel: ${p.error}` : `stareso panel open on ${p.project}: /stareso-panel again hides it.` }
  })

  // a stareso button among the mode labels at the right of the prompt footer: opens the panel, or hides it
  on('ui.render', { component: 'SessionMode' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const modes = e.props.modes
    const toggle = async () => ((await isOpen($)) ? $.ui.close({ id: PANE }) : openPanel($))
    return (
      <Box flexDirection="row" gap={1}>
        {modes.length > 0 && <Text dimColor>{modes.join(' & ')}</Text>}
        <Button key="stareso-toggle" plain dimColor onPress={() => void toggle().catch(() => undefined)}>◧ stareso</Button>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button, Code } = ui
    const p = await panelState($)
    const cols = Math.max(48, e.props.bodyColumns ?? 80)
    const act: Act = fn => () => void update($, panel, fn).catch(() => undefined)
    // the Brief and Graph tabs are one Progress tab: an older 'text' view reads as it
    const tab = (view: PanelView['view'], label: string) => (
      <Button key={`view-${view}`} variant={(p.view === 'usage') === (view === 'usage') ? 'primary' : 'secondary'} onPress={() => void show($, view).catch(() => undefined)}>{label}</Button>
    )

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text size="title" weight="bold">{p.project || 'stareso'}</Text>
          {p.brief !== '' && <Text dimColor size="footnote" wrap="truncate-end">{subtitle(p.brief, p.project)}</Text>}
        </Box>
        <Box flexDirection="row" gap={1} alignItems="center">
          <Text dimColor size="footnote">{p.updated ? `updated ${p.updated}` : 'reading…'}</Text>
          <Button key="refresh" onPress={() => void refresh($, true).catch(() => undefined)}>Refresh</Button>
          <Button key="hide" role="dismiss" dimColor onPress={() => void $.ui.close({ id: PANE }).catch(() => undefined)}>Hide</Button>
        </Box>
        <Box flexDirection="row" gap={1}>
          {tab('graph', 'Progress')}
          {tab('usage', 'Usage')}
        </Box>
        {p.error !== '' && <Text color="error">{p.error}</Text>}
        {p.view !== 'usage' && (p.graph ? progressView(ui, p, p.graph, act) : p.brief !== '' ? <Code source={p.brief} language="text" /> : <Text dimColor>reading…</Text>)}
        {/* a desktop's monospaced face runs wider than the pane's columns: the charts keep a margin so no row overflows */}
        {p.view === 'usage' && usageView(ui, p, Math.floor(cols * 0.9), act)}
        {p.view === 'usage' && p.usageNote !== '' && <Text dimColor>{p.usageNote}</Text>}
      </Box>
    )
  })
}

const STATE: Record<SliceState, { color: string; label: string; mark: string }> = {
  done: { color: 'success', label: 'done', mark: '■' },
  running: { color: 'warning', label: 'running', mark: '▶' },
  // teal and purple: the theme's two blues for these looked alike on the desktop
  ready: { color: 'planMode', label: 'could start now', mark: '■' },
  you: { color: 'merged', label: 'waits on you', mark: '■' },
  // the same full square as the others, in the theme's middle grey: □ drew smaller than ■
  waiting: { color: 'inactive', label: 'waiting', mark: '■' },
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

// the brief's head line under the project's name: "Build phase · godot-game · main, clean · 19 💭 ideas · 11 debt"
function subtitle(brief: string, project: string): string {
  return (brief.split('\n')[0] ?? '').split(' · ')
    .filter((x, i) => i > 0 || x !== project)
    .map(x => x.replace(/^Phase: (\w)(.*)$/, (_, a: string, b: string) => `${a.toUpperCase()}${b} phase`).replace(/^Pack: /, ''))
    .join(' · ')
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

// the chats working in the project now, outside the roadmap: for information only
function chatsView(ui: UI, chats: PanelView['chats'], w: number) {
  const { Box, Text } = ui
  if (!chats.length) return null
  const working = chats.filter(c => c.working).length
  // working: it computes now · launched: a step it launched works (a manager) · helpers: the build, its helpers run
  const label = (c: PanelView['chats'][number]) => (c.why === 'launched' ? 'managing' : c.why ?? 'idle')
  return (
    <Box flexDirection="column">
      {heading(ui, 'Chats', `${working} active, ${chats.length - working} idle`)}
      {chats.slice(0, MAX_CHATS).map(c => (
        <Box flexDirection="row">
          <Box width={2} flexShrink={0}><Text {...(c.working ? { color: 'claude' } : { dimColor: true })}>{c.working ? '◐' : '○'}</Text></Box>
          <Box width={Math.max(w, 10) - 2} flexShrink={0}><Text dimColor={!c.working} {...(c.working ? { color: 'claude' } : {})}>{label(c)}</Text></Box>
          <Box flexGrow={1} flexShrink={1}><Text wrap="truncate-end" dimColor={!c.working}>{c.title}{c.here ? <Text dimColor>{' · this chat'}</Text> : ''}</Text></Box>
          {c.at !== '' && <Box flexShrink={0} marginLeft={1}><Text dimColor tabular>{c.at}</Text></Box>}
        </Box>
      ))}
      {chats.length > MAX_CHATS && <Text dimColor size="footnote">{`and ${chats.length - MAX_CHATS} more`}</Text>}
    </Box>
  )
}

// ---------- progress: the brief's context and sections around the graph, laid out for a narrow dock ----------
//
// One row of slice numbers per milestone, each number in the colour of its state, its title on a dim line under it;
// hover a number for a preview of the slice's card, press it for the slice's card, press a milestone for its card (its slices, each
// pressable). Then the running helpers folded to one line each (press one for its card), the chats of the project, the
// pace and what waits for the person. Each number is its state's coloured mark beside a plain Button, in a wrapping
// row, so a press opens its card as a helper's does.

function progressView(ui: UI, p: PanelView, g: PanelGraph, act: Act) {
  const { Box, Text, Button } = ui
  const pick = (id: string) => act(q => ({ ...q, selected: q.selected === id ? '' : id }))
  const sec = sections(p.brief)
  const progress = sec.get('Progress')?.lines ?? []
  const lanes = [...(p.showFinished ? g.finished : []), ...g.lanes]
  const ids = lanes.flatMap(l => l.slices).filter(id => g.slices[id])
  const sel = p.selected
  const selSlice = g.slices[sel] as PanelSlice | undefined
  const selLane = [...g.lanes, ...g.finished].find(l => l.id === sel)
  const running = Object.entries(g.slices).filter(([, s]) => s.state === 'running')
    .sort(([, a], [, b]) => (a.started ?? '').localeCompare(b.started ?? ''))

  const idW = Math.max(3, ...lanes.map(l => l.id.length)) + 2
  const cntW = Math.max(4, ...lanes.map(l => `${l.done}/${l.total}`.length)) + 2
  const indent = idW + cntW
  // after the numbers: the milestone's ETA, or for a human or queue lane the brief's own words ("9 for you · …")
  const tail = (l: PanelLane) => (l.block ? (progress.find(x => x.startsWith(`${l.id} `))?.replace(/^\S+\s+\d+\/\d+\s+/, '') ?? '') : l.eta)
  const tailStyle = (t: string) => (t === 'waits on you' ? { color: STATE.you.color } : t.startsWith('≈') ? {} : { dimColor: true })
  const finished = progress.find(x => x.includes('every slice done'))?.replace(/\s*·\s*every slice done$/, '')
  const used = new Set(Object.values(g.slices).map(s => s.state))

  // each number is its state's coloured mark, then a plain Button (press for the slice's card, as a helper's): a
  // desktop draws a Button natively and drops the colour of a Text inside it, so the colour sits beside it, as in the
  // legend. Once a slice is picked, the numbers it is not linked to go dim, so the picked one and its links stand out
  // with their marks unchanged
  const cell = (id: string) => {
    const s = g.slices[id]
    if (!s) return null
    const linked = !selSlice || id === sel || selSlice.after.includes(id) || s.after.includes(sel)
    const label = (id.split('.')[1] ?? id).replace(/^tidy(\d*)$/, 't$1')
    return (
      <Box flexDirection="row" flexShrink={0}>
        <Text color={STATE[s.state].color}>{STATE[s.state].mark}</Text>
        <Button key={`c:${id}`} plain onPress={pick(id)} hover={{ scope: `g:${id}`, inverse: true }}
          {...(linked ? {} : { dimColor: true })}>{label}</Button>
      </Box>
    )
  }
  // the graph row holds the numbers alone, so it fits a narrow dock: the title and the ETA are in the list below it
  const lane = (l: PanelLane) => (
    <Box flexDirection="row">
      <Box width={idW} flexShrink={0}>
        <Button key={`l:${l.id}`} plain onPress={pick(l.id)}><Text bold {...(l.id === sel ? { inverse: true } : {})}>{l.id}</Text></Button>
      </Box>
      <Box width={cntW} flexShrink={0}><Text dimColor tabular>{`${l.done}/${l.total}`}</Text></Box>
      <Box flexDirection="row" flexWrap="wrap" columnGap={1} flexShrink={1}>{l.slices.filter(id => g.slices[id]).map(cell)}</Box>
    </Box>
  )
  // a milestone in the list, as a helper is: name (press for its card), title wrapped on as many lines as it needs,
  // ETA; a human or queue lane's own words ("9 for you · 12 questions") follow its title
  // the ETA in its own column before the title, so the title keeps the room to wrap; the time alone ("≈ 03:49", not
  // "≈ 03:49 tomorrow"), and "you" for a milestone that waits on the person
  const etaOf = (t: string) => (t === 'waits on you' ? 'you' : t.startsWith('≈') ? t.replace(/\s+tomorrow$/, '') : '')
  const etaW = Math.max(2, ...lanes.map(l => etaOf(tail(l)).length), ...running.map(([, s]) => (s.eta ? `≈ ${s.eta}`.length : 0))) + 2
  const milestone = (l: PanelLane) => {
    const t = tail(l)
    const eta = etaOf(t)
    return (
      <Box flexDirection="row" alignItems="flex-start">
        <Box width={indent} flexShrink={0}><Button key={`m:${l.id}`} plain onPress={pick(l.id)}>{l.id}</Button></Box>
        <Box width={etaW} flexShrink={0}><Text tabular {...tailStyle(t)}>{eta}</Text></Box>
        <Box flexGrow={1} flexShrink={1}><Text>{eta || !t ? l.title : `${l.title} · ${t}`}</Text></Box>
      </Box>
    )
  }
  // a slice id to press, its coloured mark beside the Button for the same reason as the numbers
  const chips = (where: string, list: string[]) => list.map(id => (
    <Box flexDirection="row">
      <Text color={STATE[g.slices[id]?.state ?? 'waiting'].color}>{`${STATE[g.slices[id]?.state ?? 'waiting'].mark} `}</Text>
      <Button key={`${where}:${id}`} plain onPress={pick(id)}>{id}</Button>
    </Box>
  ))
  // a running helper folded to one line: mark, slice (press for its card), title, ETA
  const helper = ([id, s]: [string, PanelSlice]) => (
    <Box flexDirection="row">
      <Box width={2} flexShrink={0}><Text color={STATE.running.color}>{STATE.running.mark}</Text></Box>
      <Box width={indent - 2} flexShrink={0}><Button key={`h:${id}`} plain onPress={pick(id)}>{id}</Button></Box>
      <Box width={etaW} flexShrink={0}><Text dimColor tabular>{s.eta ? `≈ ${s.eta}` : ''}</Text></Box>
      <Box flexGrow={1} flexShrink={1}><Text wrap="truncate-end">{s.title}</Text></Box>
    </Box>
  )
  // a hovered slice's card for the preview: its ids as coloured text, nothing to press
  const marks = (_where: string, list: string[]) => list.map(id => (
    <Text><Text color={STATE[g.slices[id]?.state ?? 'waiting'].color}>{`${STATE[g.slices[id]?.state ?? 'waiting'].mark} `}</Text>{id}</Text>
  ))
  const card = selSlice ? sliceCard(ui, g, sel, act, chips) : selLane ? laneCard(ui, g, selLane, act, pick) : null

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text size="heading" weight="semibold">{g.allDone ? `All done ≈ ${g.allDone}` : 'Progress'}</Text>
        <Text dimColor>{g.mode}</Text>
      </Box>

      <Box flexDirection="column">
        <Box flexDirection="row" flexWrap="wrap" columnGap={2} marginBottom={1}>
          {(Object.keys(STATE) as SliceState[]).filter(k => used.has(k)).map(k => (
            <Text size="footnote"><Text color={STATE[k].color}>{STATE[k].mark}</Text>{` ${STATE[k].label}`}</Text>
          ))}
        </Box>
        {lanes.map(lane)}
        {/* hovering a number previews its card just under the grid, over what follows (an open card too), so nothing
            moves: a hover reaches no hook, so each card is drawn hidden and revealed by its number. The overlay is a
            transparent row, so the card takes the width of its text and keeps its background inside its border */}
        <Box position="relative" height={0}>
          {ids.filter(id => id !== sel).map(id => (
            <Box position="absolute" top={0} left={0} right={0} flexDirection="row" alignItems="flex-start" display="none" hover={{ scope: `g:${id}`, display: 'flex' }}>
              {sliceCard(ui, g, id, act, marks, true)}
            </Box>
          ))}
        </Box>
        {g.finished.length > 0 && (
          <Box flexDirection="row" columnGap={1} marginTop={1}>
            <Box flexShrink={1}>
              <Text dimColor size="footnote" wrap="truncate-end"><Text color={STATE.done.color}>{'✓ '}</Text>{`${finished ?? g.finished.map(l => l.id).join(', ')} finished`}</Text>
            </Box>
            <Button key="finished" dimColor onPress={act(q => ({ ...q, showFinished: !q.showFinished }))}>{p.showFinished ? 'Hide' : 'Show'}</Button>
          </Box>
        )}
      </Box>
      {card && selSlice?.state !== 'running' && card}

      <Box flexDirection="column">
        {heading(ui, 'Milestones')}
        {lanes.map(milestone)}
      </Box>

      {running.length > 0 && (
        <Box flexDirection="column">
          {heading(ui, 'Helpers', sec.get('Helpers')?.head)}
          {running.map(helper)}
        </Box>
      )}
      {selSlice?.state === 'running' && card}

      {chatsView(ui, p.chats ?? [], indent)}

      {(['Pace', 'Waits for you'] as const).map(name => {
        const s = sec.get(name)
        if (!s) return null
        return (
          <Box flexDirection="column">
            {heading(ui, name, s.head)}
            {s.lines.map((x, i) => sliceText(ui, g, x, i > 0 ? { dimColor: true } : {}))}
          </Box>
        )
      })}
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

// a slice's card; a preview (the card of a hovered number) has nothing to press
function sliceCard(ui: UI, g: PanelGraph, id: string, act: Act, chips: (where: string, list: string[]) => RenderElement[], preview = false) {
  const { Box, Text, Button } = ui
  const s = g.slices[id]
  if (!s) return null
  const unblocks = Object.entries(g.slices).filter(([, x]) => x.after.includes(id)).map(([k]) => k)
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1} {...(preview ? { backgroundColor: 'inverseText', flexShrink: 1 } : {})}>
      <Text bold>{`${id} · ${s.title}`}</Text>
      <Text color={STATE[s.state].color}>{stateLine(g, id)}</Text>
      {s.branch && <Text dimColor>{`on ${s.branch}`}</Text>}
      <Text dimColor>{[s.ms, s.model, s.opus ? 'an Opus slice, the costly ones' : ''].filter(Boolean).join(' · ')}</Text>
      {s.after.length > 0 && <Box flexDirection="row" flexWrap="wrap" columnGap={1}><Text dimColor>needs</Text>{chips('needs', s.after.filter(a => g.slices[a]))}</Box>}
      {unblocks.length > 0 && <Box flexDirection="row" flexWrap="wrap" columnGap={1}><Text dimColor>unblocks</Text>{chips('unblocks', unblocks)}</Box>}
      {!preview && <Box flexDirection="row"><Button key="close-card" dimColor onPress={act(q => ({ ...q, selected: '' }))}>Close</Button></Box>}
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

// ---------- usage: the plan windows, then the tiles and the six charts of the usage report (metrics.md) ----------

const KIND: Record<string, string> = {
  build: 'suggestion', test: 'success', improve: 'claude', chat: 'warning', 'status & retro': 'inactive', status: 'inactive', retro: 'inactive', usage: 'inactive',
}
const TIER: Record<string, string> = { light: 'success', standard: 'suggestion', strong: 'claude' }
const BUILT: Record<string, string> = { helpers: 'suggestion', chat: 'warning' }
const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']
// chart 4 shows the last sessions only, until the person asks for all of them
const RECENT_SESSIONS = 12

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

function usageView(ui: UI, p: PanelView, room: number, act: Act) {
  const { Box, Text, Button, Markdown } = ui
  const c = p.usage
  // labels: a full date (yyyy-mm-dd), a milestone, "#12 build"
  const L = 11
  const open = (id: string) => (p.expanded ?? []).includes(id)
  // a chart folds to its latest rows; its button unfolds every row, with more in each, and folds it back
  const more = (id: string, total: number, shown: number) => (total > shown || open(id) ? (
    <Box flexDirection="row">
      <Button key={`more:${id}`} dimColor onPress={act(q => ({ ...q, expanded: (q.expanded ?? []).includes(id) ? (q.expanded ?? []).filter(x => x !== id) : [...(q.expanded ?? []), id] }))}>
        {open(id) ? 'Fold' : `Expand: all ${total}, with details`}
      </Button>
    </Box>
  ) : null)
  // a chart and its button stay together, with a wider gap to the next chart's title
  const pair = (...parts: (RenderElement | null | false)[]) => <Box flexDirection="column" gap={1}>{parts}</Box>
  return (
    <Box flexDirection="column" gap={2}>
      {p.usageError !== '' && <Text color="error">{p.usageError}</Text>}
      {!c && p.usageError === '' && <Text dimColor>reading the usage report… (a few seconds)</Text>}
      {c && (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
            {c.tiles.map(t => (
              <Box flexDirection="column" borderStyle="round" paddingX={1}>
                <Text dimColor size="footnote">{t.label}</Text>
                <Text bold size="heading" tabular>{t.value}</Text>
              </Box>
            ))}
          </Box>
          <Text dimColor size="footnote">{`read ${clock(p.usageAt)}, live from the transcripts · ${c.unit}`}</Text>
        </Box>
      )}
      {windowsView(ui, p.windows, Math.max(12, room - L - 7), L)}
      {c && (
        <Box flexDirection="column" gap={2}>
          {chart(ui, '1. Share of the workflow cost by step type', 'Where the tokens go: build should lead; a large chat bar is work done outside the steps.',
            c.shareByType.map((t, i) => ({
              scope: `u1:${i}`, label: t.type, segs: [{ v: t.share, color: KIND[t.type] ?? 'inactive' }],
              value: `${t.share} % · ${fmt(t.equiv)}`, detail: `${t.type}: ${fmt(t.equiv)} ≈ equiv, ${t.hours.toFixed(1)} h active, ${t.turns} turns`,
            })), L, room, Math.max(...c.shareByType.map(x => x.share)))}
          {pair(cumulativeChart(ui, c, room, L, open('u2')), more('u2', c.cumulative.days.length, FOLDED.u2))}
          {pair(milestoneChart(ui, c, room, L, open('u3')), more('u3', c.milestones.length, FOLDED.u3))}
          {pair(sessionChart(ui, c, room, L, p.allSessions), c.sessions.filter(s => s.ctx != null).length > RECENT_SESSIONS && (
            <Box flexDirection="row">
              <Button key="sessions" dimColor onPress={act(q => ({ ...q, allSessions: !q.allSessions }))}>
                {p.allSessions ? `Only the last ${RECENT_SESSIONS} sessions` : `All ${c.sessions.filter(s => s.ctx != null).length} sessions`}
              </Button>
            </Box>
          ))}
          {scatterChart(ui, c, room)}
          {(() => {
            const all = c.conductorVsHelpers.filter(b => b.conductor != null || b.helpers != null)
            const wide = open('u6')
            const steps = wide ? all : all.slice(-FOLDED.u6)
            return (
              <Box flexDirection="column" gap={1}>
                {chart(ui, '6. Conductor against helpers, per step that merged slices', 'A launched build should be mostly helpers; a bar all conductor is a chat or a test that built itself.',
                  steps.map((b, i) => {
                    const total = (b.conductor ?? 0) + (b.helpers ?? 0)
                    const share = total ? Math.round((100 * (b.conductor ?? 0)) / total) : 0
                    return {
                      scope: `u6:${i}`, label: wide ? `#${b.session} ${b.type}` : `#${b.session}`, segs: [{ v: b.conductor ?? 0, color: 'warning' }, { v: b.helpers ?? 0, color: 'suggestion' }],
                      value: wide ? `${b.merged} sl · ${share} % · ${fmt(b.conductor)} + ${fmt(b.helpers)} · ${b.helperCount} h` : `${b.merged} slices · ${share} %`,
                      valueColor: share > 50 ? 'warning' : undefined,
                      detail: `#${b.session} ${b.type} ${b.date}: conductor ${fmt(b.conductor)}, helpers ${fmt(b.helpers)} (${b.helperCount} helpers), ${b.merged} slices merged, ${fmt(total ? total / Math.max(1, b.merged) : 0)} per slice`,
                    }
                  }), L, room, Math.max(...steps.map(x => (x.conductor ?? 0) + (x.helpers ?? 0))),
                  [{ text: '█ conductor', color: 'warning' }, { text: '█ helpers', color: 'suggestion' },
                    { text: wide ? 'value: slices · conductor share · conductor + helpers ≈ equiv · helpers started' : 'value: slices merged · conductor share (target under 50 %)' }])}
                {more('u6', all.length, FOLDED.u6)}
              </Box>
            )
          })()}
          {pair(etaChart(ui, p.etaTrack, room, L, open('u7')), p.etaTrack && more('u7', p.etaTrack.rows.length, FOLDED.u7))}
          {pair(
            <Box flexDirection="row">
              <Button key="tables" dimColor onPress={act(q => ({ ...q, showTables: !q.showTables }))}>{p.showTables ? 'Hide the tables' : 'Show the tables'}</Button>
            </Box>,
            p.showTables && p.usageMd !== '' && <Markdown text={p.usageMd} />,
          )}
        </Box>
      )}
    </Box>
  )
}

// a row's bar is given in the data's own units (one part, or stacked parts) and its marks too: the chart turns them
// into cells once it knows how wide its values are
type Row = { scope: string; label: string; segs: { v: number; color: string }[]; value: string; detail: string; marks?: number[]; valueColor?: string }

// One chart of horizontal bars: label, bar, value; hovering a row reveals its detail line under the chart. The bars
// take every column the labels and the values leave in `room`, so they are as long as the dock allows.
function chart(ui: UI, title: string, caption: string, rows: Row[], L: number, room: number, max: number, legend: Seg[] = []) {
  const { Box, Text } = ui
  if (!rows.length) return null
  // the value's parts ("47 %", "168.4M") right-aligned in columns of their own, so the numbers line up down the chart
  const parts = rows.map(r => r.value.split(' · '))
  const widths = parts.reduce<number[]>((w, ps) => ps.map((x, i) => Math.max(w[i] ?? 0, x.length)), [])
  const aligned = parts.map(ps => ps.map((x, i) => (/^[\d.,≈~<>+−-]/.test(x) ? x.padStart(widths[i] ?? 0) : x.padEnd(widths[i] ?? 0))).join(' · ').trimEnd())
  const n = Math.max(10, room - L - 1 - Math.max(...aligned.map(a => a.length)))
  const cells = (v: number) => (max > 0 ? (Math.max(0, v) / max) * n : 0)
  // one part to the eighth of a cell; stacked parts in whole cells, each the total so far rounded, so they never pass
  // the track
  const drawn = (segs: Row['segs']): Seg[] => {
    const first = segs[0]
    if (segs.length === 1 && first) return [{ text: bar(first.v, max, n), color: first.color }]
    let sum = 0
    let done = 0
    return segs.map(s => {
      sum += s.v
      const upto = Math.min(n, Math.round(cells(sum)))
      const text = '█'.repeat(Math.max(0, upto - done))
      done = Math.max(done, upto)
      return { text, color: s.color }
    })
  }
  return (
    <Box flexDirection="column">
      <Text bold>{title}</Text>
      <Text dimColor size="footnote">{caption}</Text>
      {rows.map((r, i) => {
        const segs = drawn(r.segs)
        const used = segs.reduce((k, s) => k + s.text.length, 0)
        return (
          <Box flexDirection="row" hover={{ scope: r.scope }}>
            <Text mono hover={{ scope: r.scope, underline: true }}>{r.label.slice(0, L).padEnd(L)}</Text>
            {segs.filter(s => s.text !== '').map(s => <Text mono {...(s.color ? { color: s.color } : {})}>{s.text}</Text>)}
            <Text mono dimColor>{rest(used, n, (r.marks ?? []).map(m => Math.round(cells(m))))}</Text>
            <Text mono {...(r.valueColor ? { color: r.valueColor } : { dimColor: true })}>{` ${aligned[i] ?? r.value}`}</Text>
          </Box>
        )
      })}
      {legend.length > 0 && (
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          {legend.map(s => <Text size="footnote" {...(s.color ? { color: s.color } : { dimColor: true })}>{s.text}</Text>)}
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
        // one mark, at the lowest cap: two caps a few points apart drew as a double mark
        const lowest = Math.min(...win.reach.map(r => r.cap))
        const marks = win.reach.length ? [Math.round((lowest / 100) * n)] : []
        // red at a cap, amber within 10 points of one
        const level = win.reach.some(r => r.at === 'reached' || win.pct >= r.cap) ? 'error' : win.reach.some(r => win.pct >= r.cap - 10) ? 'warning' : ''
        return (
          <Box flexDirection="column">
            <Box flexDirection="row">
              <Text mono>{name.padEnd(L)}</Text>
              <Text mono color={level || 'suggestion'}>{used}</Text>
              <Text mono dimColor>{rest(used.length, n, marks)}</Text>
              <Text mono bold {...(level ? { color: level } : {})}>{`${String(win.pct).padStart(4)} %`}</Text>
            </Box>
            <Box marginLeft={L}>
              <Text dimColor size="footnote" tabular>
                {[
                  win.ratePerHour != null ? `+${win.ratePerHour} %/h` : '',
                  ...win.reach.map(r => `${r.name} ${r.cap} % ${r.at === 'reached' ? 'reached' : r.at ? `≈ ${r.at}` : 'after the reset'}`),
                  `resets ${win.resets}`,
                ].filter(Boolean).join(' · ')}
              </Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

// 2. the running total of each step type at the end of each day, stacked (the stacked variant of the skill's chart 2)
// the rows a folded chart keeps (its latest); the Expand button shows them all
const FOLDED = { u2: 14, u3: 12, u6: 8, u7: 6 }

// 7. what each ETA predicted against what the slice took, and the factor learned from the misses
function etaChart(ui: UI, t: EtaTrack | null, room: number, L: number, all: boolean) {
  const { Box, Text } = ui
  const title = '7. ETA against what happened, per merged slice'
  if (!t || !t.rows.length) {
    return (
      <Box flexDirection="column">
        <Text bold>{title}</Text>
        <Text dimColor size="footnote">No measured slice yet: a prediction is kept when a helper is first seen running, then compared with its merge.</Text>
      </Box>
    )
  }
  const rows = all ? t.rows : t.rows.slice(-FOLDED.u7)
  const miss = (r: EtaTrack['rows'][number]) => Math.round(((r.actual - r.predicted) / Math.max(1, r.predicted)) * 100)
  return chart(ui, title,
    `Times now ×${t.factor}, learned from ${t.samples} slice${t.samples > 1 ? 's' : ''}${t.medianMissPct != null ? `, median miss ${t.medianMissPct > 0 ? '+' : ''}${t.medianMissPct} %` : ''}. The bar is what it took, ┆ what was predicted.`,
    rows.map((r, i) => ({
      scope: `u7:${i}`, label: r.id, segs: [{ v: r.actual, color: Math.abs(miss(r)) > 25 ? 'warning' : 'suggestion' }], marks: [r.predicted],
      value: all ? `${r.predicted} → ${r.actual} min · ${miss(r) > 0 ? '+' : ''}${miss(r)} % · ${r.at}` : `${r.predicted} → ${r.actual} min`,
      detail: `${r.id} merged ${r.at}: predicted ${r.predicted} min, took ${r.actual} min (${miss(r) > 0 ? '+' : ''}${miss(r)} %)`,
    })), L, room, Math.max(...rows.map(r => Math.max(r.actual, r.predicted))),
    [{ text: '█ within 25 %', color: 'suggestion' }, { text: '█ missed by more', color: 'warning' }, { text: '┆ predicted' }])
}

function cumulativeChart(ui: UI, c: UsageCharts, room: number, L: number, all: boolean) {
  const pts = [...c.cumulative.points].sort((a, b) => a.day - b.day)
  if (!pts.length) return null
  const total = (q: { [key: string]: number }) => c.cumulative.kinds.reduce((k, kind) => k + (q[kind] ?? 0), 0)
  const max = Math.max(...pts.map(total))
  // the tool's days run to the day after the last step: stop at today
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const days = c.cumulative.days.filter(d => d.date <= iso).map(d => ({ d, q: [...pts].reverse().find(q => q.day < d.day + 1) })).filter(x => x.q).slice(all ? 0 : -FOLDED.u2)
  const rows: Row[] = days.map(({ d, q }, i) => ({
    scope: `u2:${i}`, label: d.date, segs: c.cumulative.kinds.map(kind => ({ v: q![kind] ?? 0, color: KIND[kind] ?? 'inactive' })),
    value: `${total(q!).toFixed(1)}M`,
    detail: `${d.date}, total so far: ${c.cumulative.kinds.map(k => `${k} ${(q![k] ?? 0).toFixed(1)}M`).join(' · ')}`,
  }))
  return chart(ui, '2. Cumulative cost by step type, at the end of each day', 'A row that grows a lot is a day of big steps; the colours show which type made it (≈ equiv, millions).',
    rows, L, room, max, c.cumulative.kinds.map(k => ({ text: `█ ${k}`, color: KIND[k] ?? 'inactive' })))
}

// 3. cost per slice by milestone, coloured by who built it, with the reference slice cost as a ┆ mark
function milestoneChart(ui: UI, c: UsageCharts, room: number, L: number, all: boolean) {
  const ref = c.referencePerSlice?.equiv ?? 0
  const max = Math.max(ref, ...c.milestones.map(m => m.equivPerSlice ?? 0))
  // the reference as a row of its own too: the ┆ mark hides under bars that pass it
  const refRow: Row[] = ref ? [{
    scope: 'u3:ref', label: 'ref', segs: [{ v: ref, color: 'inactive' }], value: fmt(ref),
    detail: `reference: ${c.referencePerSlice!.label}, ${fmt(ref)} per slice`,
  }] : []
  const rows: Row[] = (all ? c.milestones : c.milestones.slice(-FOLDED.u3)).map((m, i) => ({
    scope: `u3:${i}`, label: m.id, segs: [{ v: m.equivPerSlice ?? 0, color: BUILT[m.built] ?? 'claude' }],
    value: (m.equivPerSlice == null ? 'n/a' : fmt(m.equivPerSlice)) + (all ? ` · ${m.slices} sl · ${m.built}` : ''), marks: ref ? [ref] : [],
    detail: m.equivPerSlice == null
      ? `${m.id}: no cost per slice yet (no slice merged with a transcript), ${m.slices} slices`
      : `${m.id}: ${fmt(m.equivPerSlice)} per slice, built by ${m.built}, measured ${m.measured}, ${m.slices} slices`,
  }))
  return chart(ui, '3. Cost per slice by milestone', 'Launched builds should sit near the reference; chat-built milestones sit far above it.', [...refRow, ...rows], L, room, max,
    [{ text: '█ helpers', color: 'suggestion' }, { text: '█ chat', color: 'warning' }, { text: '█ mixed', color: 'claude' },
      ...(ref ? [{ text: `ref: ${c.referencePerSlice!.label}` }] : [])])
}

// 4. context per turn by session (cache read ÷ turns), red past 300 turns, with the base of a launched session marked
function sessionChart(ui: UI, c: UsageCharts, room: number, L: number, all: boolean) {
  const list = c.sessions.filter(s => s.ctx != null).slice(all ? 0 : -RECENT_SESSIONS)
  const BASE = 100e3
  const max = Math.max(BASE, ...list.map(s => s.ctx ?? 0))
  const baseRow: Row = { scope: 'u4:base', label: 'base', segs: [{ v: BASE, color: 'inactive' }], value: fmt(BASE), detail: 'a launched session re-reads about 100k per turn' }
  const rows: Row[] = [baseRow, ...list.map((s, i) => ({
    scope: `u4:${i}`, label: `#${s.n}`, segs: [{ v: s.ctx ?? 0, color: s.over300 ? 'error' : 'suggestion' }],
    value: `${fmt(s.ctx)} · ${s.turns} turns`, marks: [BASE], ...(s.over300 ? { valueColor: 'error' } : {}),
    detail: `#${s.n} ${s.date}: ${fmt(s.ctx)} re-read per turn, ${s.turns} turns, ${fmt(s.equiv)} ≈ equiv, ${s.helpers} helpers${s.over300 ? ': should have been split' : ''}`,
  }))]
  return chart(ui, '4. Context per turn by session', 'Launched sessions sit near the base; long mixed sessions climb past 200k. Red: over 300 turns.', rows, L, room, max,
    [{ text: 'base: a launched session, 100k' }, { text: '█ over 300 turns', color: 'error' }])
}

// 5. helper tokens against lines changed, one point per slice, both scales logarithmic; hover a point for its slices
function scatterChart(ui: UI, c: UsageCharts, cols: number) {
  const { Box, Text } = ui
  const pts = c.slices.filter(s => s.tokens > 0 && s.lines > 0)
  if (!pts.length) return null
  const W = Math.max(24, Math.min(56, cols - 12)), H = 10
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
      <Text dimColor size="footnote">Both scales logarithmic. Compare a point with its own tier's cloud, never across tiers; a ringed point cost over twice its tier's median.</Text>
      {rows}
      <Text mono dimColor>{`${' '.repeat(6)} └${'─'.repeat(W)}`}</Text>
      <Text mono dimColor>{`${' '.repeat(8)}${`${minL} lines`.padEnd(Math.max(0, W - String(maxL).length - 6))}${maxL} lines`}</Text>
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        {c.tierMedians.map(m => <Text size="footnote" color={TIER[m.tier] ?? 'inactive'}>{`● ${m.tier} (${m.model}) ${fmt(m.per100)} per 100 lines`}</Text>)}
        <Text size="footnote" color="error">◉ over twice its tier median</Text>
        <Text size="footnote" dimColor>◆ several slices · + a tier median</Text>
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
