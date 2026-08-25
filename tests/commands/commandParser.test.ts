import { describe, expect, it } from 'vitest';

import {
  MAX_COMMAND_INPUT_LENGTH,
  MAX_COMMAND_TOKEN_COUNT,
  parseCommandInput,
} from '../../src/commands/commandParser';

describe('parseCommandInput', () => {
  it('returns an explicit empty result without dispatch data', () => {
    expect(parseCommandInput('  \t ')).toEqual({ raw: '  \t ', status: 'empty' });
  });

  it('tokenizes only spaces and tabs while preserving the original input', () => {
    expect(parseCommandInput('  open\t42  next ')).toEqual({
      arguments: ['42', 'next'],
      commandName: 'open',
      raw: '  open\t42  next ',
      status: 'parsed',
    });
  });

  it('treats punctuation as literal text rather than shell or JavaScript syntax', () => {
    expect(parseCommandInput('search $(globalThis.value);|&&')).toEqual({
      arguments: ['$(globalThis.value);|&&'],
      commandName: 'search',
      raw: 'search $(globalThis.value);|&&',
      status: 'parsed',
    });
    expect(parseCommandInput("search what's-new")).toMatchObject({
      arguments: ["what's-new"],
      commandName: 'search',
      status: 'parsed',
    });
  });

  it('groups double-quoted arguments and honors backslash escapes', () => {
    expect(parseCommandInput('reply "hello there world"')).toEqual({
      arguments: ['hello there world'],
      commandName: 'reply',
      raw: 'reply "hello there world"',
      status: 'parsed',
    });
    expect(parseCommandInput('reply 3 "quoted \\"inner\\" text"')).toEqual({
      arguments: ['3', 'quoted "inner" text'],
      commandName: 'reply',
      raw: 'reply 3 "quoted \\"inner\\" text"',
      status: 'parsed',
    });
    expect(parseCommandInput('open escaped\\ value')).toEqual({
      arguments: ['escaped value'],
      commandName: 'open',
      raw: 'open escaped\\ value',
      status: 'parsed',
    });
    expect(parseCommandInput('search ""')).toEqual({
      arguments: [''],
      commandName: 'search',
      raw: 'search ""',
      status: 'parsed',
    });
  });

  it('rejects unterminated quotes and trailing escapes', () => {
    expect(parseCommandInput('open "unterminated')).toMatchObject({
      error: { code: 'unsupported-syntax' },
      status: 'error',
    });
    expect(parseCommandInput('open trailing\\')).toMatchObject({
      error: { code: 'unsupported-syntax' },
      status: 'error',
    });
  });

  it('rejects multiline and control-character input', () => {
    expect(parseCommandInput('latest\nhot')).toMatchObject({
      error: { code: 'unsupported-control-character' },
      status: 'error',
    });
    expect(parseCommandInput('latest\u0000')).toMatchObject({
      error: { code: 'unsupported-control-character' },
      status: 'error',
    });
  });

  it('bounds input length and token count', () => {
    expect(parseCommandInput('x'.repeat(MAX_COMMAND_INPUT_LENGTH + 1))).toMatchObject({
      error: { code: 'input-too-long' },
      status: 'error',
    });
    expect(
      parseCommandInput(Array.from({ length: MAX_COMMAND_TOKEN_COUNT + 1 }, () => 'x').join(' ')),
    ).toMatchObject({
      error: { code: 'too-many-tokens' },
      status: 'error',
    });
  });
});
