// Live stareso status: a pane beside the chat that runs ~/.claude/stareso/tools/progress-graph.mjs every minute while
// it is open and draws its brief (text), its graph (SVG) or the project's usage (usage-report.mjs: charts and tables),
// with toasts when a slice merges, a helper starts, a helper runs past twice the usual slice time, or a usage cap comes
// within 15 minutes. No model call: only the tools, git and the app's own usage reading.
//
//   /stareso-panel                 opens the panel, or hides it when it is open
//   /stareso-panel <folder>        opens it on that project (remembered across sessions)
//   /stareso-panel graph | usage | brief   opens it on that view
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PanelView } from '../types'

const PANE = 'stareso-status'
const TITLE = 'stareso status'
const EVERY_MS = 60_000
const USAGE_EVERY_MS = 10 * 60_000
const WIDE = 110
const EMPTY: PanelView = {
  project: '', root: '', brief: '', svg: '', updated: '', error: '', view: 'text', usageNote: '',
  usageMd: '', usageSvg: '', usageTiles: '', usageAt: 0, usageError: '',
}
const panel = atom({ plugin: 'stareso-status', key: 'panel' } as const, EMPTY)

type Window = { pct: number; resets: string; reach: { name: string; cap: number; at: string | null }[] } | null
type Snapshot = {
  project: string
  root: string
  brief: string
  svg: string
  recentMerges: { id: string; at: string }[]
  running: { id: string; minutes: number | null }[]
  perSliceMinutes: number | null
  usage: { five: Window; week: Window }
}
type Charts = {
  tiles: { label: string; value: string }[]
  shareByType: { type: string; share: number; equiv: number }[]
  milestones: { id: string; equivPerSlice: number | null; slices: number }[]
  referencePerSlice?: { label: string; equiv: number }
}

let inflight: Promise<void> | null = null
let ticking = false
let seen: { merge?: string; running: Set<string>; alerted: Set<string> } | null = null

function clock(): string {
  const d = new Date()
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
async function refresh($: EngineInterface) {
  while (inflight) await inflight
  inflight = readOnce($)
  try {
    await inflight
  } finally {
    inflight = null
  }
}

// the panel state with every field: a state kept from an older version of the mod lacks the newer ones
async function panelState($: EngineInterface): Promise<PanelView> {
  return { ...EMPTY, ...(await read($, panel)) }
}

// The folders to read, in order: the one this session settled on (a /stareso-panel <folder>, or the last good read),
// else the session's own folder, then the last project any session read (a side session often starts outside it).
async function projectRoots($: EngineInterface): Promise<string[]> {
  const state = await read($, panel)
  if (state.root) return [state.root]
  const remembered = (await $.store.get('project')) as string | undefined
  const cwd = await $.session.cwd()
  return [cwd, ...(remembered && remembered !== cwd ? [remembered] : [])]
}

async function projectRoot($: EngineInterface): Promise<string> {
  return (await projectRoots($))[0]
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
      run = await $.process.run(['node', tool, '--root', root, '--panel', ...flags], { timeoutMs: 20_000 })
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
    alerts($, s)
    await update($, panel, p => ({
      ...p, project: s.project, root: s.root, brief: s.brief, svg: s.svg, updated: clock(), error: '',
      usageNote: flags.length ? '' : 'usage windows not readable here',
    }))
    const p = await panelState($)
    if (p.view === 'usage' && Date.now() - p.usageAt > USAGE_EVERY_MS) await readUsage($)
  } catch (err) {
    await update($, panel, p => ({ ...p, updated: clock(), error: String(err).slice(0, 200) }))
  }
}

// usage-report.mjs takes a few seconds: read only for the Usage view, then every ten minutes at most
async function readUsage($: EngineInterface) {
  try {
    const root = await projectRoot($)
    const tool = await toolPath($, 'usage-report.mjs')
    const [tables, charts] = await Promise.all([
      $.process.run(['node', tool], { cwd: root, timeoutMs: 60_000 }),
      $.process.run(['node', tool, '--charts'], { cwd: root, timeoutMs: 60_000 }),
    ])
    if (tables.exitCode !== 0 || charts.exitCode !== 0) {
      const failed = tables.exitCode !== 0 ? tables : charts
      const why = errorLine(`${failed.stderr}\n${failed.stdout}`) || 'no usage report'
      await update($, panel, p => ({ ...p, usageAt: Date.now(), usageError: why }))
      return
    }
    const c = JSON.parse(charts.stdout) as Charts
    await update($, panel, p => ({
      ...p, usageAt: Date.now(), usageError: '', usageMd: tables.stdout.trim(), usageSvg: usageSvg(c),
      usageTiles: c.tiles.map(t => `${t.label} ${t.value}`).join(' · '),
    }))
  } catch (err) {
    await update($, panel, p => ({ ...p, usageAt: Date.now(), usageError: String(err).slice(0, 200) }))
  }
}

async function show($: EngineInterface, view: PanelView['view']) {
  await update($, panel, p => ({ ...p, view }))
  // the graph and the usage charts want a wide dock; a width the person dragged wins
  await $.ui.open({ id: PANE, title: TITLE, ...(view === 'text' ? {} : { columns: WIDE }) })
  if (view === 'usage') {
    const p = await panelState($)
    if (!p.usageMd || Date.now() - p.usageAt > USAGE_EVERY_MS) await readUsage($)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'stareso-panel',
      description: 'Live stareso status beside the chat: opens or hides it (optional: a project folder, or graph, usage, brief)',
      argumentHint: '[project folder | graph | usage | brief]',
    })

    return next(e)
  })

  on('command.run', { command: 'stareso-panel' }, async ($, e) => {
    const arg = (e.args ?? '').trim().replace(/^"|"$/g, '')
    const views: Record<string, PanelView['view']> = { graph: 'graph', usage: 'usage', brief: 'text', text: 'text' }
    if (!arg && (await isOpen($))) {
      await $.ui.close({ id: PANE })
      return { text: 'stareso panel hidden: /stareso-panel shows it again.' }
    }
    if (arg && !views[arg]) {
      await $.store.set('project', arg)
      await update($, panel, p => ({ ...p, root: arg, usageMd: '', usageSvg: '', usageAt: 0 }))
      seen = null
    }
    // the minute timer starts with the first opening, and reads only while the panel is open
    if (!ticking) {
      ticking = true
      $.clock.every(EVERY_MS, () => {
        isOpen($).then(open => (open ? refresh($) : undefined)).catch(() => undefined)
      })
    }
    await refresh($)
    await show($, views[arg] ?? (await read($, panel)).view)
    const p = await panelState($)

    return { text: p.error ? `stareso panel: ${p.error}` : `stareso panel open on ${p.project}: /stareso-panel again hides it.` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button, Code } = ui
    const p = await panelState($)
    const canDraw = 'Svg' in ui && e.surface !== 'terminal'
    const Svg = (ui as { Svg?: typeof ui.Box }).Svg
    const Markdown = (ui as { Markdown?: typeof ui.Box }).Markdown
    const width = Math.min(1000, Math.max(320, Math.round((e.props.bodyColumns ?? 80) * 7.2)))
    const tab = (view: PanelView['view'], label: string) => (
      <Button key={`view-${view}`} variant={p.view === view ? 'primary' : 'secondary'} onPress={() => void show($, view).catch(() => undefined)}>{label}</Button>
    )

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" gap={1}>
          <Text bold>{p.project || 'stareso'}</Text>
          <Text dimColor>{p.updated ? `updated ${p.updated}` : 'reading…'}</Text>
          <Button key="refresh" onPress={() => void refresh($).catch(() => undefined)}>Refresh</Button>
        </Box>
        <Box flexDirection="row" gap={1}>
          {tab('text', 'Brief')}
          {canDraw && tab('graph', 'Graph')}
          {tab('usage', 'Usage')}
        </Box>
        {p.error !== '' && <Text color="red">{p.error}</Text>}
        {p.view === 'graph' && canDraw && Svg && p.svg !== '' && <Svg source={p.svg} alt="Build progress graph" width={width} height={heightAt(p.svg, width)} isInteractive />}
        {(p.view === 'text' || (p.view === 'graph' && !canDraw)) && p.brief !== '' && <Code source={p.brief} language="text" />}
        {p.view === 'usage' && p.usageError !== '' && <Text color="red">{p.usageError}</Text>}
        {p.view === 'usage' && p.usageError === '' && p.usageMd === '' && <Text dimColor>reading the usage report…</Text>}
        {p.view === 'usage' && p.usageTiles !== '' && <Text bold>{p.usageTiles}</Text>}
        {p.view === 'usage' && canDraw && Svg && p.usageSvg !== '' && <Svg source={p.usageSvg} alt="Usage charts" width={width} height={heightAt(p.usageSvg, width)} />}
        {p.view === 'usage' && p.usageMd !== '' && (Markdown ? <Markdown text={p.usageMd} /> : <Code source={p.usageMd} language="markdown" />)}
        {p.view !== 'usage' && p.usageNote !== '' && <Text dimColor>{p.usageNote}</Text>}
      </Box>
    )
  })
}

// Two bar charts from usage-report --charts: the share of the cost by step type, and ≈ equiv per slice by milestone
// (with the reference slice cost as a dashed line). Light and dark from the page's own color scheme.
function usageSvg(c: Charts): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)))
  const X0 = 120, BAR = 380, ROW = 22
  const out: string[] = []
  let y = 20
  const title = (t: string) => { out.push(`<text class="h" x="20" y="${y}">${esc(t)}</text>`); y += 14 }
  title('Share of the workflow cost by step type')
  for (const s of c.shareByType) {
    const w = Math.max(2, (BAR * s.share) / 100)
    out.push(`<text class="l" x="${X0 - 8}" y="${y + 12}" text-anchor="end">${esc(s.type)}</text><rect class="b" x="${X0}" y="${y + 2}" width="${w}" height="14" rx="3"/><text class="v" x="${X0 + w + 6}" y="${y + 12}">${s.share} % · ${fmt(s.equiv)}</text>`)
    y += ROW
  }
  y += 18
  const ms = c.milestones.filter(m => m.equivPerSlice != null)
  if (ms.length) {
    title('≈ equiv per slice, by milestone (the step that merged it)')
    const ref = c.referencePerSlice?.equiv ?? 0
    const max = Math.max(ref, ...ms.map(m => m.equivPerSlice ?? 0)) || 1
    const top = y
    for (const m of ms) {
      const w = Math.max(2, (BAR * (m.equivPerSlice ?? 0)) / max)
      out.push(`<text class="l" x="${X0 - 8}" y="${y + 12}" text-anchor="end">${esc(m.id)}</text><rect class="b2" x="${X0}" y="${y + 2}" width="${w}" height="14" rx="3"/><text class="v" x="${X0 + w + 6}" y="${y + 12}">${fmt(m.equivPerSlice ?? 0)}</text>`)
      y += ROW
    }
    if (ref) {
      const x = X0 + (BAR * ref) / max
      out.push(`<line class="r" x1="${x}" y1="${top}" x2="${x}" y2="${y}"/><text class="l" x="${x + 4}" y="${y + 12}">reference ${fmt(ref)} (${esc(c.referencePerSlice?.label ?? '')})</text>`)
      y += 18
    }
  }
  const style = `<style>
:root{--t:#2c2c2a;--s:#5f5e5a;--b:#1D9E75;--b2:#7F77DD;--r:#888780}
@media (prefers-color-scheme:dark){:root{--t:#f1efe8;--s:#b4b2a9;--b:#5DCAA5;--b2:#AFA9EC;--r:#B4B2A9}}
text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif}.h{font-size:13px;font-weight:500;fill:var(--t)}
.l,.v{font-size:12px;fill:var(--s)}.b{fill:var(--b)}.b2{fill:var(--b2)}.r{stroke:var(--r);stroke-dasharray:4 3}
</style>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="680" viewBox="0 0 680 ${y + 10}" role="img"><title>Usage</title>${style}${out.join('')}</svg>`
}

// The height of an SVG drawn at this width, from its viewBox: progress-graph's SVG says width="100%" and no height, so
// the frame would otherwise fall back to its small default height and shrink the graph to fit it
function heightAt(svg: string, width: number): number | undefined {
  const m = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/.exec(svg)
  return m ? Math.round((width * Number(m[2])) / Number(m[1])) : undefined
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
