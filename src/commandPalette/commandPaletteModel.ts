import type { CommandRegistry } from '../commands/commandRegistry';
import type { WorkbenchCommandContext } from '../commands/workbenchCommands';
import { WORKBENCH_COMMAND_IDS } from '../commands/workbenchCommands';
import type { CodiconName } from '../ui/icons/codicon';

export interface CommandPaletteItem {
  readonly arguments: readonly string[];
  readonly commandId: string;
  readonly description: string;
  readonly groupLabel: string;
  readonly icon: CodiconName;
  readonly id: string;
  readonly label: string;
  readonly shortcut: string | null;
}

interface PaletteCandidate extends Omit<CommandPaletteItem, 'description' | 'shortcut'> {
  readonly availableWhen?: (context: WorkbenchCommandContext) => boolean;
  readonly descriptionSuffix: string;
}

const PALETTE_CANDIDATES: readonly PaletteCandidate[] = [
  candidate('quick-open', WORKBENCH_COMMAND_IDS.quickOpen, [], 'DOCode', 'file', 'Show Quick Open'),
  candidate(
    'panel-show',
    WORKBENCH_COMMAND_IDS.panel,
    ['show'],
    'DOCode',
    'layout-panel',
    'View: Show Bottom Panel',
  ),
  candidate(
    'panel-hide',
    WORKBENCH_COMMAND_IDS.panel,
    ['hide'],
    'DOCode',
    'layout-panel',
    'View: Hide Bottom Panel',
  ),
  candidate(
    'panel-toggle',
    WORKBENCH_COMMAND_IDS.panel,
    ['toggle'],
    'DOCode',
    'layout-panel',
    'View: Toggle Bottom Panel',
  ),
  candidate(
    'panel-terminal',
    WORKBENCH_COMMAND_IDS.panel,
    ['terminal'],
    'DOCode',
    'terminal',
    'View: Show Terminal',
  ),
  {
    ...candidate(
      'panel-outline',
      WORKBENCH_COMMAND_IDS.panel,
      ['outline'],
      'DOCode',
      'list-unordered',
      'View: Show Topic Outline',
    ),
    availableWhen: ({ view }) => view.route.kind === 'topic',
  },
  {
    ...candidate(
      'mode-code',
      WORKBENCH_COMMAND_IDS.mode,
      ['code'],
      'DOCode',
      'symbol-method',
      'Reading Mode: Code',
    ),
    availableWhen: ({ availableReadingModes }) => availableReadingModes.includes('code'),
  },
  {
    ...candidate(
      'mode-doc',
      WORKBENCH_COMMAND_IDS.mode,
      ['doc'],
      'DOCode',
      'symbol-field',
      'Reading Mode: Doc',
    ),
    availableWhen: ({ availableReadingModes }) => availableReadingModes.includes('doc'),
  },
  candidate(
    'latest',
    WORKBENCH_COMMAND_IDS.latest,
    [],
    'Linux DO',
    'list-unordered',
    'Linux DO: Open Latest Topics',
  ),
  candidate(
    'hot',
    WORKBENCH_COMMAND_IDS.hot,
    [],
    'Linux DO',
    'list-unordered',
    'Linux DO: Open Hot Topics',
  ),
  candidate(
    'search-linux-do',
    WORKBENCH_COMMAND_IDS.search,
    [],
    'Linux DO',
    'search',
    'Linux DO: Search',
  ),
  candidate(
    'reply-to-topic',
    WORKBENCH_COMMAND_IDS.reply,
    [],
    'Linux DO',
    'edit',
    'Linux DO: Reply to Topic',
  ),
  candidate(
    'like-current-post',
    WORKBENCH_COMMAND_IDS.like,
    [],
    'Linux DO',
    'heart',
    'Linux DO: Toggle Like on Current Post',
  ),
  candidate(
    'bookmark-current-post',
    WORKBENCH_COMMAND_IDS.bookmark,
    [],
    'Linux DO',
    'bookmark',
    'Linux DO: Bookmark Current Post',
  ),
];

export function createCommandPaletteItems(
  registry: CommandRegistry<WorkbenchCommandContext>,
  context: WorkbenchCommandContext,
  shortcuts: ReadonlyMap<string, string> = new Map(),
): readonly CommandPaletteItem[] {
  return PALETTE_CANDIDATES.flatMap((candidate) => {
    const metadata = registry.resolve(candidate.commandId);
    const availability = registry.getAvailability(candidate.commandId, context, 'palette');
    if (!metadata || !availability.available || candidate.availableWhen?.(context) === false) {
      return [];
    }
    return [
      {
        arguments: candidate.arguments,
        commandId: candidate.commandId,
        description: `${metadata.name}${candidate.descriptionSuffix}`,
        groupLabel: candidate.groupLabel,
        icon: candidate.icon,
        id: candidate.id,
        label: candidate.label,
        shortcut: shortcuts.get(candidate.commandId) ?? null,
      },
    ];
  });
}

export function filterCommandPaletteItems(
  items: readonly CommandPaletteItem[],
  query: string,
): readonly CommandPaletteItem[] {
  const normalized = query.trim().replace(/^>/u, '').trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) =>
    [item.label, item.description, item.groupLabel, item.shortcut ?? '']
      .join('\n')
      .toLowerCase()
      .includes(normalized),
  );
}

function candidate(
  id: string,
  commandId: string,
  arguments_: readonly string[],
  groupLabel: string,
  icon: CodiconName,
  label: string,
): PaletteCandidate {
  return {
    arguments: arguments_,
    commandId,
    descriptionSuffix: arguments_.length > 0 ? ` ${arguments_.join(' ')}` : '',
    groupLabel,
    icon,
    id,
    label,
  };
}
