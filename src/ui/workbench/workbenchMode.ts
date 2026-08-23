export type TopicReadingMode = 'code' | 'doc';
export type WorkbenchPresentationMode = TopicReadingMode;
export type WorkbenchMode = TopicReadingMode;

export function getWorkbenchModeLabel(mode: WorkbenchMode): 'Code' | 'Doc' {
  switch (mode) {
    case 'code':
      return 'Code';
    case 'doc':
      return 'Doc';
  }
}

export interface WorkbenchModeState {
  readonly topicModes: Readonly<Record<string, TopicReadingMode>>;
}

export function createWorkbenchModeState(): WorkbenchModeState {
  return { topicModes: {} };
}

export function getTopicReadingMode(state: WorkbenchModeState, viewId: string): TopicReadingMode {
  return state.topicModes[viewId] ?? 'code';
}

export function getWorkbenchPresentationMode(
  state: WorkbenchModeState,
  viewId: string,
): WorkbenchPresentationMode {
  return getTopicReadingMode(state, viewId);
}

export function applyWorkbenchPresentationMode(
  state: WorkbenchModeState,
  mode: WorkbenchPresentationMode,
  viewId: string,
  topicReady: boolean,
): WorkbenchModeState | null {
  if (mode === 'doc' && !topicReady) return null;

  const currentMode = getTopicReadingMode(state, viewId);
  const topicModes =
    topicReady && currentMode !== mode ? { ...state.topicModes, [viewId]: mode } : state.topicModes;
  if (topicModes === state.topicModes) return state;
  return { topicModes };
}

export function pruneWorkbenchModeState(
  state: WorkbenchModeState,
  retainedViewIds: ReadonlySet<string>,
): WorkbenchModeState {
  const entries = Object.entries(state.topicModes).filter(([viewId]) =>
    retainedViewIds.has(viewId),
  );
  if (entries.length === Object.keys(state.topicModes).length) return state;
  return { ...state, topicModes: Object.fromEntries(entries) };
}
