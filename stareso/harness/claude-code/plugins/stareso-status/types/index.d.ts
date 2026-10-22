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
  question?: string;
  // the slice's brief, for its card: the Goal, Files and Done when lines
  brief?: { goal?: string; files?: string; done?: string };
};

export type PanelLane = {
  id: string;
  title: string;
  kind: string;
  done: number;
  total: number;
  block: boolean;
  eta: string;
  slices: string[];
};

// progress-graph.mjs --panel: `graph`
export type PanelGraph = {
  mode: string;
  allDone: string | null;
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

// usage-report.mjs --panel: `charts`, the series of the six charts of the usage report (metrics.md)
export type UsageCharts = {
  unit: string;
  tiles: { label: string; value: string }[];
  shareByType: { type: string; share: number; equiv: number; hours: number; turns: number }[];
  cumulative: { kinds: string[]; days: { day: number; date: string }[]; points: ({ day: number } & { [kind: string]: number })[] };
  milestones: { id: string; built: string; equivPerSlice: number | null; measured: string; slices: number }[];
  referencePerSlice: { label: string; equiv: number } | null;
  conductorVsHelpers: { session: string; date: string; type: string; merged: number; conductor: number | null; helpers: number | null; helperCount: number }[];
  sessions: { n: number; date: string; ctx: number | null; turns: number; equiv: number; helpers: number; over300: boolean }[];
  slices: { id: string; tier: string; tokens: number; lines: number; outlier: boolean }[];
  tierMedians: { tier: string; model: string; tokens: number | null; lines: number | null; per100: number | null }[];
};

// progress-graph.mjs: what the ETAs missed, the factor learned from it, the latest measured slices (minutes)
export type EtaTrack = {
  factor: number;
  samples: number;
  medianMissPct: number | null;
  rows: { id: string; predicted: number; actual: number; at: string }[];
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
  allSessions: boolean;
  // the app's chats in the project (a manager, a build, a side chat, this chat), working or idle, shown for information.
  // `why` says what makes one active: it works, a step it launched works, or it is the build and helpers run
  chats: { title: string; at: string; working: boolean; why?: 'working' | 'launched' | 'helpers'; here?: boolean }[];
  // the ETA learning, drawn as chart 7 of the usage view
  etaTrack: EtaTrack | null;
  // the usage charts the person expanded (all their rows, and more in each row)
  expanded: string[];
};

declare module 'claude-code' {
  interface PluginState {
    'stareso-status': { panel: PanelView };
  }
}
