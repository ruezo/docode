import { MAX_COMMAND_INPUT_LENGTH, MAX_COMMAND_TOKEN_COUNT } from '../commands/commandParser';

export type VirtualShellParseResult =
  | { readonly status: 'empty'; readonly raw: string }
  | {
      readonly status: 'error';
      readonly raw: string;
      readonly error: { readonly message: string };
    }
  | {
      readonly status: 'parsed';
      readonly raw: string;
      readonly commandName: string;
      readonly arguments: readonly string[];
    };

export function parseVirtualShellInput(raw: string): VirtualShellParseResult {
  if (raw.length > MAX_COMMAND_INPUT_LENGTH) return parseError(raw, 'Command input is too long.');
  if (hasUnsupportedControlCharacter(raw)) {
    return parseError(raw, 'Command input contains an unsupported control character.');
  }

  const tokens: string[] = [];
  let current = '';
  let quote: 'single' | 'double' | null = null;
  let escaping = false;
  let tokenStarted = false;

  const pushToken = (): boolean => {
    if (!tokenStarted) return true;
    tokens.push(current);
    current = '';
    tokenStarted = false;
    return tokens.length <= MAX_COMMAND_TOKEN_COUNT;
  };

  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (character === undefined) continue;
    if (escaping) {
      current += character;
      tokenStarted = true;
      escaping = false;
      continue;
    }
    if (character === '\\' && quote !== 'single') {
      escaping = true;
      tokenStarted = true;
      continue;
    }
    if (character === "'" && quote !== 'double') {
      quote = quote === 'single' ? null : 'single';
      tokenStarted = true;
      continue;
    }
    if (character === '"' && quote !== 'single') {
      quote = quote === 'double' ? null : 'double';
      tokenStarted = true;
      continue;
    }
    if (quote === null && /[ \t]/u.test(character)) {
      if (!pushToken()) return parseError(raw, 'Command input contains too many arguments.');
      continue;
    }
    if (quote === null && character === '>') {
      if (!pushToken()) return parseError(raw, 'Command input contains too many arguments.');
      const append = raw[index + 1] === '>';
      tokens.push(append ? '>>' : '>');
      if (append) index += 1;
      if (tokens.length > MAX_COMMAND_TOKEN_COUNT) {
        return parseError(raw, 'Command input contains too many arguments.');
      }
      continue;
    }
    if (quote === null && isUnsupportedOperator(character)) {
      return parseError(raw, `Unsupported virtual shell operator: ${character}`);
    }
    current += character;
    tokenStarted = true;
  }

  if (escaping) return parseError(raw, 'Command input ends with an incomplete escape.');
  if (quote !== null) return parseError(raw, 'Command input contains an unterminated quote.');
  if (!pushToken()) return parseError(raw, 'Command input contains too many arguments.');
  const commandName = tokens[0];
  if (!commandName) return { raw, status: 'empty' };
  return { arguments: tokens.slice(1), commandName, raw, status: 'parsed' };
}

function hasUnsupportedControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return (
      codePoint !== undefined &&
      (codePoint <= 8 || (codePoint >= 10 && codePoint <= 31) || codePoint === 127)
    );
  });
}

function isUnsupportedOperator(character: string): boolean {
  return (
    character === '|' ||
    character === '&' ||
    character === ';' ||
    character === '<' ||
    character === '`'
  );
}

function parseError(raw: string, message: string): VirtualShellParseResult {
  return { error: { message }, raw, status: 'error' };
}
