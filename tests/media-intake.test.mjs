import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMediaConverter, MEDIA_MAX_BYTES, runMediaProcess } from '../lib/media-intake.mjs';

// A real 4 x 3 JPEG; the subprocess fixture stands in for an installed FFmpeg.
const JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAADAAQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDzmiiisTxz/9k=';

async function harness(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'packsignal-media-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const script = join(directory, 'decoder.cjs'), log = join(directory, 'calls.jsonl');
  await writeFile(script, `
    const fs = require('node:fs');
    const args = process.argv.slice(3), probe = process.argv[2] === 'probe';
    const input = probe ? args.at(-1) : args[args.indexOf('-i') + 1];
    const mode = fs.readFileSync(input, 'utf8');
    fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ probe, args, input, tokenVisible: Boolean(process.env.GEMINI_API_KEY) }) + '\\n');
    if (mode === 'timeout') setTimeout(() => {}, 10000);
    else if (mode === 'broken') { process.stderr.write('private artwork text'); process.exitCode = 1; }
    else if (probe) {
      if (mode === 'bad-json') process.stdout.write('invalid');
      else process.stdout.write(JSON.stringify({ streams: [{ width: mode === 'huge' ? 10000 : 960, height: mode === 'huge' ? 10000 : 1280 }], format: { duration: mode === 'long' ? '121' : '5' } }));
    } else fs.writeFileSync(args.at(-1), mode === 'bad-frame' ? Buffer.from('not a jpeg') : Buffer.from(${JSON.stringify(JPEG)}, 'base64'));
  `);
  const convert = createMediaConverter({
    ffmpeg: 'encode', ffprobe: 'probe', tempRoot: directory,
    run: (executable, args, limits) => runMediaProcess(process.execPath, [script, executable, ...args], limits),
    ...options,
  });
  return {
    convert, directory,
    calls: async () => (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse),
    assertClean: async () => assert.deepEqual((await readdir(directory)).filter(name => name.startsWith('packsignal-media-')), []),
  };
}

test('fallback extracts bounded frames from uploaded bytes and removes source and frames', async t => {
  const { convert, directory, calls, assertClean } = await harness(t);
  const result = await convert({ bytes: Buffer.from('ok'), name: '../../external;echo.mp4', kind: 'video', maxFrames: 2 });
  assert.equal(result.decoder, 'server');
  assert.equal(result.frames.length, 2);
  assert.deepEqual(result.frames.map(frame => [frame.width, frame.height, frame.mimeType, frame.timeSeconds]), [[4, 3, 'image/jpeg', 1.25], [4, 3, 'image/jpeg', 3.75]]);
  assert.equal(result.frames[0].base64, JPEG);
  const recorded = await calls();
  assert.equal(recorded.length, 3);
  for (const { args, input, tokenVisible } of recorded) {
    assert.ok(input.startsWith(directory + '/packsignal-media-'));
    assert.ok(input.endsWith('/input.mp4'));
    assert.equal(args[args.indexOf('-protocol_whitelist') + 1], 'file');
    assert.ok(!args[args.indexOf('-format_whitelist') + 1].includes('hls'));
    assert.equal(args[args.indexOf('-threads') + 1], '1');
    assert.equal(tokenVisible, false);
  }
  assert.equal(recorded[1].args[recorded[1].args.indexOf('-frames:v') + 1], '1');
  await assertClean();
});

test('five-second video samples four distinct evenly spaced times when the intake has room', async t => {
  const { convert, assertClean } = await harness(t);
  const result = await convert({ bytes: Buffer.from('ok'), name: 'four-view.mp4', kind: 'video', maxFrames: 8 });
  assert.deepEqual(result.frames.map(frame => frame.timeSeconds), [.625, 1.875, 3.125, 4.375]);
  await assertClean();
});

test('image fallback produces one JPEG and does not seek', async t => {
  const { convert, calls, assertClean } = await harness(t);
  const result = await convert({ bytes: Buffer.from('ok'), name: 'phone-photo.tiff', kind: 'image', maxFrames: 8 });
  assert.equal(result.frames.length, 1);
  assert.equal(result.frames[0].timeSeconds, undefined);
  assert.equal(result.source.durationSeconds, undefined);
  assert.ok(!(await calls())[1].args.includes('-ss'));
  await assertClean();
});

test('input byte, count, kind, duration and pixel limits fail before expensive conversion', async t => {
  const { convert, calls, assertClean } = await harness(t);
  const base = { bytes: Buffer.from('ok'), kind: 'video', maxFrames: 2 };
  for (const [input, code] of [
    [{ ...base, bytes: Buffer.alloc(0) }, 'MEDIA_EMPTY'],
    [{ ...base, bytes: new Uint8Array(MEDIA_MAX_BYTES + 1) }, 'MEDIA_TOO_LARGE'],
    [{ ...base, bytes: 'https://example.test/movie.mp4' }, 'MEDIA_EMPTY'],
    [{ ...base, kind: 'document' }, 'MEDIA_KIND'],
    [{ ...base, maxFrames: 0 }, 'MEDIA_FRAME_LIMIT'],
    [{ ...base, maxFrames: 9 }, 'MEDIA_FRAME_LIMIT'],
    [{ ...base, bytes: Buffer.from('long') }, 'MEDIA_DURATION_LIMIT'],
    [{ ...base, bytes: Buffer.from('huge') }, 'MEDIA_RESOLUTION_LIMIT'],
  ]) await assert.rejects(convert(input), error => error.code === code);
  assert.equal((await calls()).length, 2);
  await assertClean();
});

test('decoder failures and invalid output clean up and permit a later valid conversion', async t => {
  const { convert, assertClean } = await harness(t);
  for (const mode of ['broken', 'bad-json', 'bad-frame']) {
    await assert.rejects(convert({ bytes: Buffer.from(mode), kind: 'image' }), error => error.code.startsWith('MEDIA_') && !error.message.includes('private artwork'));
    await assertClean();
  }
  assert.equal((await convert({ bytes: Buffer.from('ok'), kind: 'image' })).frames.length, 1);
  await assertClean();
});

test('timed-out subprocess is killed and concurrent conversions receive a retryable error', async t => {
  const { convert, assertClean } = await harness(t, { timeoutMs: 150 });
  const pending = convert({ bytes: Buffer.from('timeout'), kind: 'video' });
  await assert.rejects(convert({ bytes: Buffer.from('ok'), kind: 'image' }), error => error.code === 'MEDIA_BUSY' && error.status === 429);
  await assert.rejects(pending, error => error.code === 'MEDIA_TIMEOUT' && error.status === 408);
  await assertClean();
});

test('missing decoder returns actionable unavailable status instead of a process error', async () => {
  await assert.rejects(runMediaProcess('/nonexistent/packsignal-ffmpeg', [], { cwd: tmpdir(), timeoutMs: 1000 }), error => error.code === 'MEDIA_DECODER_UNAVAILABLE' && error.status === 503);
});

test('subprocess stdout and stderr are bounded', async () => {
  await assert.rejects(runMediaProcess(process.execPath, ['-e', 'process.stdout.write("x".repeat(2048)); setTimeout(()=>{},10000)'], { cwd: tmpdir(), timeoutMs: 1000, maxOutputBytes: 1024 }), error => error.code === 'MEDIA_OUTPUT_LIMIT');
});
