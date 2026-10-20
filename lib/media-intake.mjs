import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

export const MEDIA_MAX_BYTES = 30_000_000;
export const MEDIA_MAX_SECONDS = 120;
const MAX_SOURCE_PIXELS = 24_000_000;
const MAX_FRAME_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_FRAME_BYTES = 24_000_000;
const MAX_EDGE = 1800;
// Exclude playlist / network demuxers even when a playlist is renamed to .mp4.
const FORMATS = 'mov,matroska,webm,avi,mpeg,mpegts,ogg,image2,jpeg_pipe,png_pipe,webp_pipe,bmp_pipe,tiff_pipe,gif,avif';
const EXTENSIONS = new Set('.mp4 .mov .m4v .webm .mkv .avi .3gp .3g2 .mpeg .mpg .mts .m2ts .ogv .jpg .jpeg .png .webp .bmp .tif .tiff .gif .avif .heic .heif'.split(' '));

function failure(code, message, status = 422) {
  return Object.assign(new Error(message), { code, status });
}

// Output is bounded, errors never echo decoder stderr (which may contain source data).
export function runMediaProcess(executable, args, { cwd, timeoutMs, maxOutputBytes = 256 * 1024 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH || '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' },
    });
    let output = [], size = 0, processFailure;
    const abort = error => {
      if (processFailure) return;
      processFailure = error;
      child.kill('SIGKILL');
    };
    const timer = setTimeout(() => abort(failure('MEDIA_TIMEOUT', 'Media conversion took too long. Try a shorter video or a smaller photo.', 408)), Math.max(1, timeoutMs));
    child.stdout.on('data', chunk => {
      size += chunk.length;
      if (size > maxOutputBytes) abort(failure('MEDIA_OUTPUT_LIMIT', 'The media decoder returned too much data. Try another file.'));
      else output.push(chunk);
    });
    child.stderr.on('data', chunk => {
      size += chunk.length;
      if (size > maxOutputBytes) abort(failure('MEDIA_OUTPUT_LIMIT', 'The media decoder returned too much data. Try another file.'));
    });
    child.on('error', error => {
      processFailure = error.code === 'ENOENT'
        ? failure('MEDIA_DECODER_UNAVAILABLE', 'Server media conversion is unavailable. Try a JPEG photo or an H.264 MP4 video.', 503)
        : failure('MEDIA_DECODE_FAILED', 'The server could not read this media file. Try another photo or video.');
    });
    // Wait for close after killing so temporary files cannot be recreated after cleanup.
    child.on('close', code => {
      clearTimeout(timer);
      if (processFailure) return reject(processFailure);
      if (code !== 0) return reject(failure('MEDIA_DECODE_FAILED', 'This file is damaged or its codec is not supported. Try a JPEG photo or an H.264 MP4 video.'));
      resolve(Buffer.concat(output));
    });
  });
}

function jpegDimensions(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw failure('MEDIA_INVALID_FRAME', 'The media decoder could not produce a photo.');
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset++] !== 0xff) break;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const size = bytes.readUInt16BE(offset);
    if (size < 2 || offset + size > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2].includes(marker) && size >= 8) {
      const height = bytes.readUInt16BE(offset + 3), width = bytes.readUInt16BE(offset + 5);
      if (width > 0 && height > 0 && width <= MAX_EDGE && height <= MAX_EDGE) return { width, height };
      break;
    }
    offset += size;
  }
  throw failure('MEDIA_INVALID_FRAME', 'The media decoder produced an invalid or oversized photo.');
}

/**
 * Browser-decoder fallback. Accepts ONLY an uploaded byte array, never a URL/path.
 * Returns {decoder:'server', frames:[{base64,mimeType,name,width,height,timeSeconds?}],
 * source:{kind,width,height,durationSeconds?}}. Temporary source/frames are deleted.
 * A factory permits isolated tests; the exported convertMedia is one process-wide
 * slot. Errors have public `code`, `status`, and `message` fields for HTTP callers.
 */
export function createMediaConverter({
  ffmpeg = process.env.PACKPROOF_FFMPEG || 'ffmpeg',
  ffprobe = process.env.PACKPROOF_FFPROBE || 'ffprobe',
  tempRoot = tmpdir(), timeoutMs = 45_000, run = runMediaProcess,
} = {}) {
  let busy = false;
  return async function convertMedia({ bytes, name = '', kind, maxFrames = 4 } = {}) {
    if (!(bytes instanceof Uint8Array) || !bytes.byteLength) throw failure('MEDIA_EMPTY', 'Choose a non-empty photo or video.', 400);
    if (bytes.byteLength > MEDIA_MAX_BYTES) throw failure('MEDIA_TOO_LARGE', 'Choose a photo or video up to 30 MB.', 413);
    if (!['video', 'image'].includes(kind)) throw failure('MEDIA_KIND', 'Choose a photo or video.', 400);
    if (!Number.isInteger(maxFrames) || maxFrames < 1 || maxFrames > 8) throw failure('MEDIA_FRAME_LIMIT', 'Request between one and eight artwork pages.', 400);
    if (busy) throw failure('MEDIA_BUSY', 'Another media file is being converted. Try again in a moment.', 429);
    busy = true;
    let directory;
    const deadline = Date.now() + timeoutMs;
    const invoke = (executable, args) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw failure('MEDIA_TIMEOUT', 'Media conversion took too long. Try a shorter video or a smaller photo.', 408);
      return run(executable, args, { cwd: directory, timeoutMs: remaining });
    };
    try {
      directory = await mkdtemp(join(tempRoot, 'packsignal-media-'));
      const extension = extname(String(name)).toLowerCase();
      const sourcePath = join(directory, `input${EXTENSIONS.has(extension) ? extension : '.media'}`);
      await writeFile(sourcePath, bytes, { mode: 0o600 });
      const safeInput = ['-protocol_whitelist', 'file', '-format_whitelist', FORMATS, '-probesize', '5000000', '-analyzeduration', '5000000', '-max_alloc', '67108864', '-threads', '1'];
      const probeBytes = await invoke(ffprobe, [
        '-v', 'error', ...safeInput, '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,duration:format=duration', '-of', 'json', sourcePath,
      ]);
      let probe;
      try { probe = JSON.parse(probeBytes.toString('utf8')); }
      catch { throw failure('MEDIA_DECODE_FAILED', 'The server could not read the media information. Try another file.'); }
      const stream = probe.streams?.[0];
      const width = Number(stream?.width), height = Number(stream?.height);
      if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw failure('MEDIA_NO_IMAGE', 'This file does not contain a readable picture or video stream.');
      if (width > 12000 || height > 12000 || width * height > MAX_SOURCE_PIXELS) throw failure('MEDIA_RESOLUTION_LIMIT', 'This image or video is too large to convert here. Export a version below 24 megapixels.');
      const duration = Number(probe.format?.duration || stream.duration);
      if (kind === 'video' && (!Number.isFinite(duration) || duration <= 0)) throw failure('MEDIA_DURATION', 'This video has no readable duration. Save it as a regular MP4 and try again.');
      if (kind === 'video' && duration > MEDIA_MAX_SECONDS) throw failure('MEDIA_DURATION_LIMIT', 'Choose a video no longer than two minutes.');
      // Four evenly spaced video stills give a rotating package a chance to
      // show its four principal sides. Short or partial clips still require
      // face confirmation; this is sampling, not orientation inference.
      const count = kind === 'image' ? 1 : Math.min(maxFrames, Math.max(4, Math.ceil(duration / 4)));
      const frames = [];let totalFrameBytes=0;
      for (let index = 0; index < count; index++) {
        const timeSeconds = kind === 'video' ? Math.min(duration * (index + .5) / count, Math.max(0, duration - .08)) : undefined;
        const framePath = join(directory, `frame-${index + 1}.jpg`);
        await invoke(ffmpeg, [
          '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...safeInput,
          ...(kind === 'video' ? ['-ss', timeSeconds.toFixed(4)] : []), '-i', sourcePath,
          '-map', '0:v:0', '-an', '-sn', '-dn', '-frames:v', '1', '-threads', '1', '-filter_threads', '1',
          '-vf', `scale=w='min(${MAX_EDGE},iw)':h='min(${MAX_EDGE},ih)':force_original_aspect_ratio=decrease`,
          '-q:v', '3', '-f', 'image2', '-fs', String(MAX_FRAME_BYTES), framePath,
        ]);
        const frameBytes = await readFile(framePath);
        if (!frameBytes.length || frameBytes.length > MAX_FRAME_BYTES) throw failure('MEDIA_INVALID_FRAME', 'The server could not create a usable photo from this file.');
        totalFrameBytes+=frameBytes.length;if(totalFrameBytes>MAX_TOTAL_FRAME_BYTES)throw failure('MEDIA_OUTPUT_LIMIT','This video creates too much image data. Try a shorter clip or add fewer photos.');
        const dimensions = jpegDimensions(frameBytes);
        frames.push({
          base64: frameBytes.toString('base64'), mimeType: 'image/jpeg',
          name: `${kind === 'video' ? 'video-frame' : 'photo'}-${String(index + 1).padStart(2, '0')}.jpg`,
          ...dimensions, ...(kind === 'video' ? { timeSeconds } : {}),
        });
      }
      return { decoder: 'server', frames, source: { kind, width, height, ...(kind === 'video' ? { durationSeconds: duration } : {}) } };
    } catch (error) {
      if (error.code?.startsWith('MEDIA_')) throw error;
      throw failure('MEDIA_DECODE_FAILED', 'The server could not convert this file. Try another photo or video.');
    } finally {
      try { if (directory) await rm(directory, { recursive: true, force: true }); }
      finally { busy = false; }
    }
  };
}

export const convertMedia = createMediaConverter();
