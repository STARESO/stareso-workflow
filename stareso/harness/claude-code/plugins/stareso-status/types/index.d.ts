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
  // the app's chats in the project (a manager, a build, a side chat), working or idle, shown for information
  chats: { title: string; at: string; working: boolean }[];
  // the address of the project's dashboard server the mod started, linked in the header while it runs
  dashboard: string;
};

declare module 'claude-code' {
  interface PluginState {
    'stareso-status': { panel: PanelView };
  }
}
