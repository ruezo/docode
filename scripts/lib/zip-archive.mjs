import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;

export function readZipEntries(buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  let directoryEnd = -1;
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) {
      directoryEnd = offset;
      break;
    }
  }
  assert(directoryEnd >= 0, 'ZIP end-of-central-directory record was not found.');
  assert.equal(buffer.readUInt16LE(directoryEnd + 4), 0, 'Multi-disk ZIP files are not supported.');
  assert.equal(buffer.readUInt16LE(directoryEnd + 6), 0, 'Multi-disk ZIP files are not supported.');
  const entryCount = buffer.readUInt16LE(directoryEnd + 10);
  const directorySize = buffer.readUInt32LE(directoryEnd + 12);
  const directoryOffset = buffer.readUInt32LE(directoryEnd + 16);
  assert.equal(
    directoryOffset + directorySize,
    directoryEnd,
    'ZIP central directory has unexpected trailing data.',
  );

  const entries = new Map();
  let offset = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(buffer.readUInt32LE(offset), CENTRAL_DIRECTORY_ENTRY, 'Invalid ZIP entry header.');
    const flags = buffer.readUInt16LE(offset + 8);
    const compression = buffer.readUInt16LE(offset + 10);
    const expectedCrc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    assert.equal(flags & 1, 0, `Encrypted ZIP entry is forbidden: ${name}`);
    assert.equal(entries.has(name), false, `Duplicate ZIP entry is forbidden: ${name}`);
    safeExtractionPath('/docode-package-root', name);

    assert.equal(
      buffer.readUInt32LE(localOffset),
      LOCAL_FILE_HEADER,
      `Invalid local ZIP header: ${name}`,
    );
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    const contents =
      compression === 0
        ? compressed
        : compression === 8
          ? inflateRawSync(compressed)
          : assert.fail(`Unsupported ZIP compression method ${String(compression)}: ${name}`);
    assert.equal(contents.length, uncompressedSize, `ZIP size mismatch: ${name}`);
    assert.equal(crc32(contents), expectedCrc, `ZIP CRC mismatch: ${name}`);
    entries.set(name, contents);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(offset, directoryEnd, 'ZIP directory entry count or size is inconsistent.');
  return entries;
}

export function safeExtractionPath(root, name) {
  assert(name && !name.includes('\\'), `Unsafe ZIP entry name: ${name}`);
  assert.equal(path.posix.normalize(name), name, `Unsafe ZIP entry path: ${name}`);
  assert(!path.posix.isAbsolute(name) && !name.endsWith('/'), `Unsafe ZIP entry path: ${name}`);
  const target = path.resolve(root, ...name.split('/'));
  assert(
    target.startsWith(`${path.resolve(root)}${path.sep}`),
    `ZIP entry escapes the extraction root: ${name}`,
  );
  return target;
}

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function toPosix(value) {
  return value.split(path.sep).join('/');
}

export async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(target) : Promise.resolve([target]);
    }),
  );
  return nested.flat().sort();
}
