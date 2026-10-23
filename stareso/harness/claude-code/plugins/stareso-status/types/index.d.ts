// What the panel draws: the project, the tool's brief, the graph's lanes and slices, the usage windows and charts, when
// each was read, the view, and what the person picked in it (a slice or a milestone, finished milestones, the tables).
export type SliceState = 'done' | 'running' | 'ready' | 'you' | 'waiting';

export type PanelSlice = {
  title: string;
  ms: string;
  state: SliceState;
  after: string[];
  model?: string;
  opus?: boolean;
  minutes?: number | null;
  started?: string | null;
  branch?: string;
  eta?: string;
  /** the 10 % and 90 % finish of 200 simulated builds, "12:51–13:38" */
  etaRange?: string;
  /** the planned build time ("36m"), what is left of it for a running slice */
  planned?: string;
  /** the planned start ("07:30"), for a slice not running yet */
  planStart?: string;
  question?: string;
};

export type PanelLane = {
  id: string;
  title: string;
  kind: string;
  done: number;
  total: number;
  block: boolean;
  eta: string;
  etaRange?: string;
  /** the planned build time left, "2h10" (optional: older tools leave it out) */
  planned?: string;
  slices: string[];
};

// progress-graph.mjs --panel: `graph`
export type PanelGraph = {
  mode: string;
  allDone: string | null;
  allDoneRange?: string;
  pace: string | null;
  lanes: PanelLane[];
  finished: PanelLane[];
  hidden: string[];
  slices: { [id: string]: PanelSlice };
};

// one usage window of the plan, with the time each stop cap is reached at the present rate
export type UsageWindow = {
  pct: number;
  resets: string;
  ratePerHour: number | null;
  basis: string | null;
  reach: { name: string; cap: number; at: string | null }[];
} | null;

// usage-report.mjs --panel: `charts`, the series of the nine charts of the usage report (metrics.md)
export type UsageCharts = {
  unit: string;
  tiles: { label: string; value: string }[];
  // carried: the median share of the context a run of this type started with (a manager's grows with its age)
  shareByType: { type: string; share: number; equiv: number; hours: number; turns: number; carried?: number | null }[];
  cumulative: { kinds: string[]; days: { day: number; date: string }[]; points: ({ day: number } & { [kind: string]: number })[] };
  milestones: { id: string; built: string; equivPerSlice: number | null; measured: string; slices: number }[];
  referencePerSlice: { label: string; equiv: number } | null;
  conductorVsHelpers: { session: string; date: string; type: string; merged: number; conductor: number | null; helpers: number | null; helperCount: number }[];
  sessions: { n: number; date: string; ctx: number | null; turns: number; equiv: number; helpers: number; over300: boolean }[];
  slices: { id: string; tier: string; tokens: number; lines: number; outlier: boolean }[];
  tierMedians: { tier: string; model: string; tokens: number | null; lines: number | null; per100: number | null }[];
  // the gates run inside the builds (metrics.md, "Failing"), null with no gate run
  failing?: {
    runs: number; fails: number; perSlice: number | null; equiv: number; share: number | null; reruns: number; flakes: number;
    flakeEquiv: number; rebuilt: number; relaunched: number; byGate: { gate: string; runs: number; fails: number }[]; flaky: { name: string; n: number }[];
  } | null;
  // the plan changes made while milestones were built (metrics.md, "Plan interventions")
  plan?: {
    offEquiv: number; share: number | null; offSlices: number; plannedSlices: number; commits: number; messages: number; steered: number;
    milestones: { id: string; commits: number; added: number; rewritten: number; chain: number; offBuilt: number; planned: number; offEquiv: number }[];
  };
};

// progress-graph.mjs: the spread of slice durations, what the ETAs missed, the latest measured slices (minutes)
export type EtaTrack = {
  samples: number;
  medianMissPct: number | null;
  /** the last `window` durations: typical (median) and the 10 % and 90 % points */
  typical: number | null;
  lo: number | null;
  hi: number | null;
  window: number;
  /** slices whose duration fell inside the range predicted for them */
  inRange: { n: number; hit: number } | null;
  /** the updated predictions of long runs against the first one: mean error in minutes */
  updates?: { slices: number; firstErr: number; lastErr: number } | null;
  rows: {
    id: string; predicted: number; actual: number; at: string;
    /** the range predicted for its duration, minutes from its start */
    lo?: number; hi?: number;
    /** later predictions: minutes into the run, then the duration predicted then */
    updates?: { at: number; predicted: number }[];
  }[];
};

export type PanelView = {
  project: string;
  root: string;
  brief: string;
  graph: PanelGraph | null;
  windows: { five: UsageWindow; week: UsageWindow } | null;
  updated: string;
  error: string;
  view: 'text' | 'graph' | 'usage';
  selected: string;
  showFinished: boolean;
  usageNote: string;
  usage: UsageCharts | null;
  usageMd: string;
  usageAt: number;
  usageMerge: string;
  usageError: string;
  showTables: boolean;
  // the app's chats in the project (a manager, a build, a side chat, this chat), working or idle, shown for information.
  // `why` says what makes one active: it works, a step it launched works, or it is the build and helpers run
  chats: { title: string; at: string; working: boolean; why?: 'working' | 'launched' | 'helpers'; here?: boolean }[];
  // the ETA learning, drawn as chart 7 of the usage view
  etaTrack: EtaTrack | null;
  // the usage charts the person expanded (all their rows, and more in each row)
  expanded: string[];
  // where the person paged to in an expanded list: the index of its first row shown (a list not here is at its default end)
  pages: Record<string, number>;
};

declare module 'claude-code' {
  interface PluginState {
    'stareso-status': { panel: PanelView };
  }
}
