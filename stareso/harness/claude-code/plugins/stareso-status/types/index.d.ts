// What the panel draws: the project, the tool's brief and SVG, the usage report, when each was read, and the view.
export type PanelView = {
  project: string;
  root: string;
  brief: string;
  svg: string;
  updated: string;
  error: string;
  view: 'text' | 'graph' | 'usage';
  usageNote: string;
  usageMd: string;
  usageSvg: string;
  usageTiles: string;
  usageAt: number;
  usageError: string;
};

declare module 'claude-code' {
  interface PluginState {
    'stareso-status': { panel: PanelView };
  }
}
