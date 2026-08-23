import type { CommandRegistry } from '../../commands/commandRegistry';
import type { CommandDispatchResult } from '../../commands/commandTypes';
import {
  QUICK_OPEN_COMMAND_ID,
  type WorkbenchCommandContext,
} from '../../commands/workbenchCommands';
import {
  createCommandPaletteItems,
  filterCommandPaletteItems,
} from '../../commandPalette/commandPaletteModel';
import { QuickInput } from '../quickOpen/QuickInput';

interface CommandPaletteProps {
  readonly context: WorkbenchCommandContext;
  readonly onDismiss: () => void;
  readonly registry: CommandRegistry<WorkbenchCommandContext>;
  readonly shortcuts?: ReadonlyMap<string, string>;
}

export function CommandPalette({ context, onDismiss, registry, shortcuts }: CommandPaletteProps) {
  const items = createCommandPaletteItems(registry, context, shortcuts);

  return (
    <QuickInput
      ariaLabel="Command Palette"
      className="docode-command-palette"
      emptyMessage="No matching commands."
      filterItems={filterCommandPaletteItems}
      getItemMeta={(item) => item.shortcut}
      inputAriaLabel="Type the name of a command"
      items={items}
      onDismiss={onDismiss}
      onRunItem={async (item, signal) => {
        const result = await registry.dispatchById({
          arguments: item.arguments,
          commandId: item.commandId,
          context,
          signal,
          source: 'palette',
        });
        return commandResult(result);
      }}
      placeholder="Type the name of a command"
      prefix=">"
    />
  );
}

function commandResult(result: CommandDispatchResult) {
  return result.status === 'success'
    ? result.commandId === QUICK_OPEN_COMMAND_ID
      ? ({ kind: 'keep-open' } as const)
      : ({ kind: 'close' } as const)
    : result.status === 'error'
      ? ({ kind: 'error', message: result.error.message } as const)
      : ({ kind: 'error', message: 'No command was selected.' } as const);
}
