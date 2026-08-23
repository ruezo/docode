import {
  COMMAND_PALETTE_COMMAND_ID,
  QUICK_OPEN_COMMAND_ID,
  TOGGLE_TERMINAL_COMMAND_ID,
} from '../commands/workbenchCommands';
import { detectWorkbenchOperatingSystem } from '../platform/workbenchPlatform';
import { isLinuxDoComposerTarget } from '../linuxdo/capabilities';

export type WorkbenchPlatform = 'mac' | 'other';

export interface WorkbenchKeybindingInvocation {
  readonly arguments: readonly string[];
  readonly commandId: string;
}

interface InstallWorkbenchKeybindingsOptions {
  readonly dispatch: (invocation: WorkbenchKeybindingInvocation) => void;
  readonly document: Document;
  readonly enabled: () => boolean;
  readonly platform?: WorkbenchPlatform;
}

interface KeybindingDefinition extends WorkbenchKeybindingInvocation {
  readonly code: 'Backquote' | 'KeyP';
  readonly shift: boolean;
}

const KEYBINDINGS: readonly KeybindingDefinition[] = [
  {
    arguments: [],
    code: 'KeyP',
    commandId: QUICK_OPEN_COMMAND_ID,
    shift: false,
  },
  {
    arguments: [],
    code: 'KeyP',
    commandId: COMMAND_PALETTE_COMMAND_ID,
    shift: true,
  },
  {
    arguments: [],
    code: 'Backquote',
    commandId: TOGGLE_TERMINAL_COMMAND_ID,
    shift: false,
  },
];

export function installWorkbenchKeybindings({
  dispatch,
  document,
  enabled,
  platform = detectWorkbenchPlatform(document.defaultView?.navigator),
}: InstallWorkbenchKeybindingsOptions): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (!enabled()) return;
    const invocation = resolveWorkbenchKeybinding(event, platform);
    if (!invocation) return;
    event.preventDefault();
    event.stopPropagation();
    dispatch(invocation);
  };
  document.addEventListener('keydown', onKeyDown, true);
  return () => {
    document.removeEventListener('keydown', onKeyDown, true);
  };
}

export function resolveWorkbenchKeybinding(
  event: KeyboardEvent,
  platform: WorkbenchPlatform,
): WorkbenchKeybindingInvocation | null {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.repeat ||
    event.altKey ||
    !hasExactPrimaryModifier(event, platform) ||
    isLinuxDoComposerTarget(event.target)
  ) {
    return null;
  }
  const definition = KEYBINDINGS.find(
    ({ code, shift }) => event.code === code && event.shiftKey === shift,
  );
  if (!definition || blocksEditableTarget(event.target, definition.commandId)) return null;
  return { arguments: definition.arguments, commandId: definition.commandId };
}

export function getWorkbenchShortcutLabels(
  platform: WorkbenchPlatform,
): ReadonlyMap<string, string> {
  return new Map([
    [QUICK_OPEN_COMMAND_ID, platform === 'mac' ? '⌘P' : 'Ctrl+P'],
    [COMMAND_PALETTE_COMMAND_ID, platform === 'mac' ? '⇧⌘P' : 'Ctrl+Shift+P'],
    [TOGGLE_TERMINAL_COMMAND_ID, platform === 'mac' ? '⌘`' : 'Ctrl+`'],
  ]);
}

export function getWorkbenchAriaKeyShortcut(
  commandId: string,
  platform: WorkbenchPlatform,
): string | null {
  const primary = platform === 'mac' ? 'Meta' : 'Control';
  switch (commandId) {
    case QUICK_OPEN_COMMAND_ID:
      return `${primary}+P`;
    case COMMAND_PALETTE_COMMAND_ID:
      return `${primary}+Shift+P`;
    case TOGGLE_TERMINAL_COMMAND_ID:
      return `${primary}+\u0060`;
    default:
      return null;
  }
}

export function detectWorkbenchPlatform(navigator: Navigator | undefined): WorkbenchPlatform {
  if (!navigator) return 'other';
  return detectWorkbenchOperatingSystem(navigator) === 'mac' ? 'mac' : 'other';
}

function hasExactPrimaryModifier(event: KeyboardEvent, platform: WorkbenchPlatform): boolean {
  return platform === 'mac' ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

function blocksEditableTarget(target: EventTarget | null, commandId: string): boolean {
  if (!(target instanceof Element)) return false;
  const editable = target.closest(
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
  );
  if (!editable) return false;
  return !(
    commandId === TOGGLE_TERMINAL_COMMAND_ID && editable.closest('.docode-terminal') !== null
  );
}
