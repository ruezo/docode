export const MAX_COMMAND_INPUT_LENGTH = 2_048;
export const MAX_COMMAND_TOKEN_COUNT = 64;

export type CommandParseErrorCode =
  'input-too-long' | 'too-many-tokens' | 'unsupported-control-character' | 'unsupported-syntax';

export type CommandParseResult =
  | { readonly status: 'empty'; readonly raw: string }
  | {
      readonly status: 'error';
      readonly raw: string;
      readonly error: { readonly code: CommandParseErrorCode; readonly message: string };
    }
  | {
      readonly status: 'parsed';
      readonly raw: string;
      readonly commandName: string;
      readonly arguments: readonly string[];
    };

export function parseCommandInput(raw: string): CommandParseResult {
  if (raw.length > MAX_COMMAND_INPUT_LENGTH) {
    return parseError(raw, 'input-too-long', 'Command input is too long.');
  }
  if (hasUnsupportedControlCharacter(raw)) {
    return parseError(
      raw,
      'unsupported-control-character',
      'Command input contains an unsupported control character.',
    );
  }

  const tokenized = tokenizeCommandInput(raw);
  if (!tokenized.ok) return parseError(raw, 'unsupported-syntax', tokenized.message);
  const { tokens } = tokenized;
  if (tokens.length === 0) return { raw, status: 'empty' };
  if (tokens.length > MAX_COMMAND_TOKEN_COUNT) {
    return parseError(raw, 'too-many-tokens', 'Command input contains too many arguments.');
  }
  const commandName = tokens[0];
  if (!commandName) return { raw, status: 'empty' };
  return {
    arguments: tokens.slice(1),
    commandName,
    raw,
    status: 'parsed',
  };
}

type CommandTokenization =
  | { readonly ok: true; readonly tokens: readonly string[] }
  | { readonly ok: false; readonly message: string };

function tokenizeCommandInput(raw: string): CommandTokenization {
  const tokens: string[] = [];
  let current = '';
  let hasCurrent = false;
  let quoted = false;
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw.charAt(index);
    if (character === '\\') {
      const next = raw.charAt(index + 1);
      if (next === '') {
        return { message: 'A trailing backslash must escape a character.', ok: false };
      }
      current += next;
      hasCurrent = true;
      index += 1;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      hasCurrent = true;
      continue;
    }
    if (!quoted && (character === ' ' || character === '\t')) {
      if (hasCurrent) {
        tokens.push(current);
        current = '';
        hasCurrent = false;
      }
      continue;
    }
    current += character;
    hasCurrent = true;
  }
  if (quoted) {
    return { message: 'A quoted argument must be closed with a matching quote.', ok: false };
  }
  if (hasCurrent) tokens.push(current);
  return { ok: true, tokens };
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

function parseError(raw: string, code: CommandParseErrorCode, message: string): CommandParseResult {
  return { error: { code, message }, raw, status: 'error' };
}
