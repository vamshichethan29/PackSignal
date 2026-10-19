const faces = [
  ['front', 'Front'], ['right', 'Right side'], ['back', 'Back'],
  ['left', 'Left side'], ['top', 'Top'], ['bottom', 'Bottom'],
];
let captureSequence = 0;
const captureName = prefix => `${prefix}-${String(++captureSequence).padStart(3, '0')}.jpg`;

export function cameraIntakeMarkup() {
  return `<section class="camera-intake panel" data-camera-intake>
    <div class="eyebrow">CAMERA & PHOTO INTAKE</div>
    <h3>Capture package faces</h3>
    <p class="subtle">Take face-by-face photos, choose images, or extract stills from a video. Common photo and video formats up to 30 MB are supported; videos can be up to two minutes and provide up to eight review pages. Photos continue through the normal 2D review; confirm face crops in Sources before the 3D preview.</p>
    <div class="camera-intake-actions">
      <label>Face to capture<select data-capture-face>${faces.map(([id,label]) => `<option value="${id}">${label}</option>`).join('')}</select></label>
      <button type="button" class="secondary" data-camera-start>Open camera</button>
      <label class="secondary camera-file-button">Choose photos<input type="file" accept="image/*" multiple capture="environment" data-camera-photos></label>
      <label class="secondary camera-file-button">Choose video<input type="file" accept="video/*" data-camera-video></label>
    </div>
    <div class="camera-live" data-camera-live hidden><video data-camera-video-preview autoplay muted playsinline></video><button type="button" class="primary" data-camera-capture>Take photo</button><button type="button" class="textbutton" data-camera-stop>Close camera</button></div>
    <p class="subtle" data-camera-status aria-live="polite">Image checks look for possible blur and glare. They are guidance only and do not certify photo quality.</p>
    <ul class="camera-quality-list" data-camera-quality></ul>
  </section>`;
}

export function assessPhotoQuality(imageData) {
  const { data, width, height } = imageData;
  const gray = new Uint8Array(width * height);
  let bright = 0, samples = 0;
  for (let y = 0, index = 0; y < height; y++) for (let x = 0; x < width; x++, index++) {
    const offset = index * 4, r = data[offset], g = data[offset + 1], b = data[offset + 2];
    gray[index] = (r * 77 + g * 150 + b * 29) >> 8;
    if (r > 246 && g > 246 && b > 246) bright++;
    samples++;
  }
  let sum = 0, squareSum = 0, count = 0;
  for (let y = 1; y < height - 1; y += 2) for (let x = 1; x < width - 1; x += 2) {
    const i = y * width + x;
    const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
    sum += lap; squareSum += lap * lap; count++;
  }
  const variance = count ? squareSum / count - (sum / count) ** 2 : 0;
  const glare = samples ? bright / samples : 0;
  return { blur: variance < 75, glare: glare > 0.13, variance: Math.round(variance), glarePercent: Math.round(glare * 100) };
}

function canvasQuality(canvas) {
  const width = 160, height = Math.max(1, Math.round(160 * canvas.height / canvas.width));
  const sample = document.createElement('canvas'); sample.width = width; sample.height = height;
  const context = sample.getContext('2d', { willReadFrequently: true });
  context.drawImage(canvas, 0, 0, width, height);
  return assessPhotoQuality(context.getImageData(0, 0, width, height));
}

async function normalizeImage(file, name, captureFace = 'unassigned', convertMedia) {
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch (browserError) {
    if (!convertMedia) throw new Error(`This browser cannot decode ${file.name}. Try JPEG/PNG or use a recent browser.`);
    const converted = await convertMedia(file, 'image', 1);
    const frame = converted[0];
    if (!frame) throw new Error(`Could not read ${file.name} as an image.`);
    bitmap = await createImageBitmap(frame);
  }
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const quality = canvasQuality(canvas);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .9));
  if (!blob) throw new Error(`Could not process ${file.name}.`);
  const result = new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  result.cameraMedia = true;
  result.captureQuality = quality;
  result.captureFace = captureFace;
  return result;
}

function videoMetadata(video, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('loadedmetadata', loaded);
      video.removeEventListener('error', failed);
    };
    const loaded = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('The browser could not decode the video.')); };
    if (video.readyState >= 1 && Number.isFinite(video.duration)) return resolve();
    video.addEventListener('loadedmetadata', loaded, { once: true });
    video.addEventListener('error', failed, { once: true });
    timer = setTimeout(() => { cleanup(); reject(new Error('The browser timed out opening the video.')); }, timeoutMs);
  });
}

function seek(video, time) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => { clearTimeout(timer); video.removeEventListener('seeked', done); video.removeEventListener('error', failed); };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('The browser could not read a video frame.')); };
    const target = Math.min(Math.max(0, time), Math.max(0, video.duration - .08));
    if (Math.abs(video.currentTime - target) < .015 && video.readyState >= 2) return resolve();
    timer = setTimeout(() => { cleanup(); reject(new Error('Timed out reading a video frame.')); }, 10000);
    video.addEventListener('seeked', done, { once: true });
    video.addEventListener('error', failed, { once: true });
    video.currentTime = target;
  });
}

function frameFile(video, face, prefix = 'video') {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 2400 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const quality = canvasQuality(canvas);
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob) return reject(new Error('Could not extract a video frame.'));
    const file = new File([blob], captureName(prefix), { type: 'image/jpeg', lastModified: Date.now() });
    file.cameraMedia = true; file.captureQuality = quality; file.captureFace = face; resolve(file);
  }, 'image/jpeg', .9));
}

export function mountCameraIntake(container, onFiles, getCurrentCount = () => 0, convertMedia) {
  const root = container?.matches?.('[data-camera-intake]') ? container : container?.querySelector?.('[data-camera-intake]');
  if (!root) return;
  const videoPanel = root.querySelector('[data-camera-live]');
  const videoPreview = root.querySelector('[data-camera-video-preview]');
  const status = root.querySelector('[data-camera-status]');
  const qualityList = root.querySelector('[data-camera-quality]');
  const face = () => root.querySelector('[data-capture-face]').value;
  let stream = null, closed = false;
  const stop = () => {
    stream?.getTracks().forEach(track => track.stop());
    stream = null; if (videoPreview) videoPreview.srcObject = null; if (videoPanel) videoPanel.hidden = true;
  };
  root.closest('dialog')?.addEventListener('close', () => { closed = true; stop(); }, { once: true });
  const addFiles = files => {
    if (!files.length || closed) return;
    if (files.length > 8 - getCurrentCount()) { status.textContent = 'Keep up to eight photos or video frames in one intake. Remove an item to add another.'; return; }
    onFiles(files);
    for (const file of files) {
      const q = file.captureQuality;
      const warnings = [q?.blur && 'possible blur', q?.glare && `possible glare (${q.glarePercent}%)`].filter(Boolean);
      const item = document.createElement('li');
      item.dataset.captureName = file.name;
      item.textContent = `${file.name}: ${warnings.length ? warnings.join(', ') + ' — inspect before use' : 'no strong blur/glare signal; inspect the original anyway'}`;
      qualityList.append(item);
    }
    status.textContent = `${files.length} image${files.length === 1 ? '' : 's'} added as artwork page${files.length === 1 ? '' : 's'}. Map the photographed faces in Sources after the review is created.`;
  };
  root.querySelector('[data-camera-start]').addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not offer camera access here. Use Choose photos or Choose video instead.');
      const nextStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (closed) { nextStream.getTracks().forEach(track => track.stop()); return; }
      stream = nextStream;
      videoPreview.srcObject = stream; videoPanel.hidden = false; await videoPreview.play();
      status.textContent = 'Camera ready. Choose the face name, frame it square-on, and take a photo.';
    } catch (error) { status.textContent = error.message || 'Camera permission was not available. Use photo or video upload instead.'; }
    finally { button.disabled = false; }
  });
  root.querySelector('[data-camera-stop]').addEventListener('click', stop);
  root.querySelector('[data-camera-capture]').addEventListener('click', async event => {
    if (!stream) return;
    const button = event.currentTarget; button.disabled = true;
    try {
      if (!videoPreview.videoWidth || !videoPreview.videoHeight) throw new Error('Wait for the camera preview, then take the photo again.');
      const file = await frameFile(videoPreview, face(), 'camera');
      addFiles([file]);
    } catch (error) { status.textContent = error.message || 'Could not capture this image.'; }
    finally { button.disabled = false; }
  });
  root.querySelector('[data-camera-photos]').addEventListener('change', async event => {
    const input = event.currentTarget, selected = [...input.files]; input.value = '';
    if (selected.length > 8 - getCurrentCount()) { status.textContent = 'Choose at most eight more photos. The review allows up to eight artwork pages.'; return; }
    try {
      const files = [];
      const labelledFace = selected.length === 1 ? face() : 'unassigned';
      for (const file of selected) {
        if (file.size > 30 * 1024 * 1024) { status.textContent = `${file.name} is over the 30 MB photo limit.`; continue; }
        files.push(await normalizeImage(file, captureName('photo'), labelledFace, convertMedia));
      }
      addFiles(files);
    } catch (error) { status.textContent = error.message; }
  });
  root.querySelector('[data-camera-video]').addEventListener('change', async event => {
    const input = event.currentTarget, source = input.files?.[0]; input.value = '';
    if (!source) return;
    if (source.size > 30 * 1024 * 1024) { status.textContent = 'Choose a video up to 30 MB.'; return; }
    status.textContent = 'Preparing representative stills from the video…';
    if (getCurrentCount() >= 8) { status.textContent = 'Keep up to eight photos or video frames in one intake. Remove an item first.'; return; }
    let url = null, video = null, serverFallbackError = null;
    const output = [];
    try {
      if (convertMedia) {
        try {
          const frames = await convertMedia(source, 'video', 8 - getCurrentCount());
          for (const [index, frame] of frames.entries()) {
            const normalized = await normalizeImage(frame, captureName('video'), 'unassigned', convertMedia);
            normalized.captureTime = frame.captureTime;
            output.push(normalized);
          }
        } catch (serverError) {
          serverFallbackError = serverError;
          if (closed) return;
          status.textContent = 'Server conversion was unavailable; trying this browser’s video decoder…';
          video = document.createElement('video'); url = URL.createObjectURL(source);
          video.preload = 'metadata'; video.muted = true; video.playsInline = true;
          const metadata = videoMetadata(video); video.src = url; video.load(); await metadata;
          if (!Number.isFinite(video.duration) || video.duration <= 0) throw serverError;
          const count = Math.min(8 - getCurrentCount(), Math.max(3, Math.ceil(video.duration / 4)));
          for (let index = 0; index < count; index++) {
            await seek(video, video.duration * ((index + .5) / count));
            const frame = await frameFile(video, 'unassigned', 'video');
            frame.captureTime = video.currentTime;
            output.push(frame);
          }
          addFiles(output);
          return;
        }
        if (output.length) addFiles(output);
      } else {
        video = document.createElement('video'); url = URL.createObjectURL(source);
        video.preload = 'metadata'; video.muted = true; video.playsInline = true;
        const metadata = videoMetadata(video); video.src = url; video.load(); await metadata;
        if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error('Video duration could not be read.');
        const count = Math.min(8 - getCurrentCount(), Math.max(3, Math.ceil(video.duration / 4)));
        for (let index = 0; index < count; index++) {
          await seek(video, video.duration * ((index + .5) / count));
          const frame = await frameFile(video, 'unassigned', 'video');
          frame.captureTime = video.currentTime;
          output.push(frame);
        }
        addFiles(output);
      }
    } catch (error) {
      status.textContent = serverFallbackError
        ? `${serverFallbackError.message} The browser fallback also failed: ${error.message}`
        : error.message;
    }
    finally { if (url) URL.revokeObjectURL(url); if (video) { video.removeAttribute('src'); video.load(); } }
  });
}

export function refreshCameraIntakeQuality(container, files = []) {
  const root = container?.matches?.('[data-camera-intake]') ? container : container?.querySelector?.('[data-camera-intake]');
  const list = root?.querySelector('[data-camera-quality]');
  if (!list) return;
  list.replaceChildren();
  for (const file of files.filter(item => item.cameraMedia)) {
    const q = file.captureQuality, warnings = [q?.blur && 'possible blur', q?.glare && `possible glare (${q.glarePercent}%)`].filter(Boolean);
    const item = document.createElement('li'); item.dataset.captureName = file.name;
    item.textContent = `${file.name}: ${warnings.length ? warnings.join(', ') + ' — inspect before use' : 'no strong blur/glare signal; inspect the original anyway'}`;
    list.append(item);
  }
}

async function jpegBytes(file, convertMedia) {
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch {
    if (!convertMedia) throw new Error(`Could not open ${file.name} in this browser.`);
    const [frame] = await convertMedia(file, 'image', 1);
    if (!frame) throw new Error(`Could not open ${file.name} as an image.`);
    bitmap = await createImageBitmap(frame);
  }
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .92));
  if (!blob) throw new Error(`Could not prepare ${file.name} for review.`);
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height, label: file.name };
}

function byteJoin(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0), output = new Uint8Array(length);
  let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}
const ascii = text => new TextEncoder().encode(text);

export function buildArtworkPdf(images) {
  if (!Array.isArray(images) || !images.length) throw new Error('Add at least one package photo.');
  const objects = [];
  const pageIds = images.map((_, index) => 3 + index * 3);
  objects.push(ascii('<< /Type /Catalog /Pages 2 0 R >>'));
  objects.push(ascii(`<< /Type /Pages /Count ${images.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`));
  images.forEach((image, index) => {
    const pageId = pageIds[index], contentId = pageId + 1, imageId = pageId + 2;
    const pageWidth = 612, imageHeight = pageWidth * image.height / image.width, pageHeight = imageHeight;
    const content = ascii(`q\n${pageWidth} 0 0 ${imageHeight} 0 0 cm\n/Im${index} Do\nQ\n`);
    objects.push(ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight.toFixed(2)}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> /XObject << /Im${index} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`));
    objects.push(byteJoin([ascii(`<< /Length ${content.length} >>\nstream\n`), content, ascii('endstream')]));
    objects.push(byteJoin([ascii(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`), image.bytes, ascii('\nendstream')]));
  });
  const chunks = [ascii('%PDF-1.4\n%PackSignal\n')], offsets = [0]; let length = chunks[0].length;
  for (let i = 0; i < objects.length; i++) {
    offsets.push(length); const body = byteJoin([ascii(`${i + 1} 0 obj\n`), objects[i], ascii('\nendobj\n')]); chunks.push(body); length += body.length;
  }
  const xref = length;
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) table += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  table += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  chunks.push(ascii(table));
  return byteJoin(chunks);
}

export async function combineArtworkImagesAsPdf(files, convertMedia) {
  const images = await Promise.all(files.map(file => jpegBytes(file, convertMedia)));
  const combined = new File([buildArtworkPdf(images)], 'package-camera-capture.pdf', { type: 'application/pdf', lastModified: Date.now() });
  combined.captureFaces = images.map((image, index) => {
    const file = files[index];
    return { page: index + 1, face: ['front','right','back','left','top','bottom'].includes(file.captureFace) ? file.captureFace : 'unassigned', box: [0, 0, 1, 1] };
  });
  return combined;
}
