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
  if (raw.includes('"') || raw.includes('\\')) {
    return parseError(raw, 'unsupported-syntax', 'Quoted and escaped arguments are not supported.');
  }

  const trimmed = raw.trim();
  if (!trimmed) return { raw, status: 'empty' };

  const tokens = trimmed.split(/[ \t]+/u);
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
