import { useEffect, useRef, useState, type MouseEvent } from 'react';

import type { CommandDispatchResult, CommandMetadata } from '../../commands/commandTypes';
import { CLEAR_TERMINAL_COMMAND_ID } from '../../commands/workbenchCommands';
import { TerminalSession } from '../../terminal/terminalSession';
import { Codicon } from '../icons/codicon';
import { appendTerminalHistory } from './terminalInputModel';

interface TerminalViewProps {
  readonly clearRequest?: number;
  readonly commands?: readonly CommandMetadata[];
  readonly executeCommand: (input: string, signal: AbortSignal) => Promise<CommandDispatchResult>;
  readonly focusRequest: number;
  readonly username?: string | null;
}

interface TerminalEntry {
  readonly id: number;
  readonly input: string;
  readonly lines: readonly string[];
  readonly prompt: string;
  readonly state: 'error' | 'pending' | 'success';
}

const MAX_TERMINAL_ENTRIES = 200;

export function TerminalView({
  clearRequest = 0,
  commands = [],
  executeCommand,
  focusRequest,
  username = null,
}: TerminalViewProps) {
  const [entries, setEntries] = useState<readonly TerminalEntry[]>([]);
  const [history, setHistory] = useState<readonly string[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [, setSessionRevision] = useState(0);
  const [session] = useState(() => new TerminalSession(username));
  const activeController = useRef<AbortController | null>(null);
  const historyDraft = useRef('');
  const inputElement = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const nextEntryId = useRef(1);
  const output = useRef<HTMLDivElement>(null);
  const prompt = session.getPrompt(username);

  useEffect(
    () => () => {
      mounted.current = false;
      activeController.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (focusRequest > 0) inputElement.current?.focus();
  }, [focusRequest]);

  useEffect(() => {
    if (clearRequest <= 0) return;
    activeController.current?.abort();
    activeController.current = null;
    window.requestAnimationFrame(() => {
      if (!mounted.current) return;
      setEntries([]);
      setPendingId(null);
      inputElement.current?.focus();
    });
  }, [clearRequest]);

  useEffect(() => {
    const element = output.current;
    if (!element) return;
    const scrollTo: unknown = Reflect.get(element, 'scrollTo');
    if (typeof scrollTo === 'function') {
      Reflect.apply(scrollTo, element, [{ top: element.scrollHeight }]);
    } else {
      element.scrollTop = element.scrollHeight;
    }
  }, [entries]);

  const run = async () => {
    if (pendingId !== null) return;
    const entryId = nextEntryId.current;
    nextEntryId.current += 1;
    const submittedInput = input;
    const controller = new AbortController();
    activeController.current = controller;
    setEntries((current) =>
      appendEntry(current, {
        id: entryId,
        input: submittedInput,
        lines: ['Running registered command…'],
        prompt,
        state: 'pending',
      }),
    );
    setPendingId(entryId);
    setInput('');
    setHistoryCursor(null);
    historyDraft.current = '';

    let result: CommandDispatchResult;
    let historyEntry: string | null = null;
    try {
      session.setUsername(username);
      const execution = await session.execute(submittedInput, controller.signal, executeCommand);
      result = execution.result;
      historyEntry = execution.historyEntry;
    } catch {
      result = {
        commandId: null,
        error: {
          code: 'internal-error',
          message: 'Command failed unexpectedly.',
          retryable: true,
        },
        status: 'error',
      };
    }
    if (!mounted.current || activeController.current !== controller) return;
    activeController.current = null;
    setPendingId(null);
    setSessionRevision((current) => current + 1);
    setHistory((current) => appendTerminalHistory(current, historyEntry));
    setEntries((current) =>
      result.status === 'success' && result.commandId === CLEAR_TERMINAL_COMMAND_ID
        ? []
        : result.status === 'empty'
          ? current.filter(({ id }) => id !== entryId)
          : current.map((entry) => (entry.id === entryId ? completeEntry(entry, result) : entry)),
    );
    window.requestAnimationFrame(() => {
      const element = inputElement.current;
      if (
        element &&
        !element.closest('[hidden]') &&
        shouldRestoreTerminalInputFocus(element, document.activeElement)
      ) {
        element.focus();
      }
    });
  };

  const acceptCompletion = (insertText: string) => {
    setInput(insertText);
    historyDraft.current = insertText;
    setHistoryCursor(null);
    window.requestAnimationFrame(() => {
      const element = inputElement.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(element.value.length, element.value.length);
    });
  };

  const navigateHistory = (direction: -1 | 1): boolean => {
    if (history.length === 0) return false;
    if (historyCursor === null) {
      if (direction === 1) return false;
      historyDraft.current = input;
      const nextCursor = history.length - 1;
      setHistoryCursor(nextCursor);
      setInput(history[nextCursor] ?? input);
      return true;
    }

    const nextCursor = historyCursor + direction;
    if (nextCursor < 0) {
      setHistoryCursor(0);
      setInput(history[0] ?? input);
      return true;
    }
    if (nextCursor >= history.length) {
      setHistoryCursor(null);
      setInput(historyDraft.current);
      return true;
    }
    setHistoryCursor(nextCursor);
    setInput(history[nextCursor] ?? input);
    return true;
  };

  const focusInputFromTerminalSurface = (event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;

    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('a, button, input, textarea, select, [contenteditable="true"]')
    ) {
      return;
    }

    const selection = event.currentTarget.ownerDocument.defaultView?.getSelection();
    if (selection?.toString()) return;

    inputElement.current?.focus({ preventScroll: true });
  };

  return (
    <section
      aria-label="Linux DO command terminal"
      className="docode-terminal"
      onClick={focusInputFromTerminalSurface}
    >
      <div
        aria-live="polite"
        aria-relevant="additions text"
        className="docode-terminal__viewport"
        ref={output}
        role="log"
      >
        <div className="docode-terminal__output">
          {entries.map((entry) => (
            <div className="docode-terminal__entry" data-state={entry.state} key={entry.id}>
              <div className="docode-terminal__command-line">
                <span aria-hidden="true" className="docode-terminal__command-marker" />
                <span aria-hidden="true" className="docode-terminal__prompt-label">
                  {entry.prompt}
                </span>
                <span>{entry.input}</span>
              </div>
              {entry.lines.map((line, index) => (
                <div
                  className="docode-terminal__result-line"
                  key={`${String(entry.id)}:${String(index)}`}
                >
                  {entry.state === 'pending' && index === 0 ? (
                    <Codicon name="loading" spin />
                  ) : null}
                  <span>{line}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <form
        aria-label="Linux DO command prompt. Registered commands only; no shell execution."
        className="docode-terminal__prompt"
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
      >
        <span aria-hidden="true" className="docode-terminal__command-marker" />
        <label className="docode-terminal__prompt-label" htmlFor="docode-terminal-input">
          {prompt}
        </label>
        <input
          aria-disabled={pendingId !== null}
          aria-label="Linux DO command input"
          autoCapitalize="none"
          autoComplete="off"
          className="docode-terminal__input"
          id="docode-terminal-input"
          onChange={(event) => {
            const value = event.currentTarget.value;
            setInput(value);
            historyDraft.current = value;
            setHistoryCursor(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Tab') {
              event.preventDefault();
              const completions = session.getSuggestions(commands, input, false);
              if (completions.length === 1 && completions[0]) {
                acceptCompletion(completions[0].insertText);
              }
              return;
            }
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              if (navigateHistory(event.key === 'ArrowUp' ? -1 : 1)) {
                event.preventDefault();
              }
            }
          }}
          ref={inputElement}
          readOnly={pendingId !== null}
          role="combobox"
          spellCheck={false}
          type="text"
          value={input}
        />
        {pendingId !== null ? (
          <button
            aria-label="Cancel running command"
            className="docode-terminal__cancel"
            data-docode-tooltip="Cancel running command"
            onClick={() => {
              activeController.current?.abort();
            }}
            type="button"
          >
            <Codicon name="debug-stop" />
          </button>
        ) : null}
      </form>
    </section>
  );
}

function appendEntry(
  entries: readonly TerminalEntry[],
  entry: TerminalEntry,
): readonly TerminalEntry[] {
  return [...entries.slice(-(MAX_TERMINAL_ENTRIES - 1)), entry];
}

function shouldRestoreTerminalInputFocus(
  input: HTMLInputElement,
  activeElement: Element | null,
): boolean {
  if (!activeElement || activeElement === input.ownerDocument.body) return true;
  return input.closest('.docode-terminal')?.contains(activeElement) === true;
}

function completeEntry(
  entry: TerminalEntry,
  result: Exclude<CommandDispatchResult, { status: 'empty' }>,
): TerminalEntry {
  return result.status === 'error'
    ? { ...entry, lines: [result.error.message], state: 'error' }
    : {
        ...entry,
        lines: result.output
          ? result.output.kind === 'text'
            ? [result.output.text]
            : result.output.lines
          : ['Command completed.'],
        state: 'success',
      };
}
