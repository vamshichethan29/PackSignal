/**
 * PackSignal — Scan Session Controller (public/scan-session.js)
 * Phase 10A: Manages the client-side state of a physical package scanning session.
 * Handles short-lived token authentication, progressive face uploads, retakes, and session recovery.
 */

export class ScanSession {
  constructor(options = {}) {
    const urlParams = new URLSearchParams(window.location.search);
    this.sessionId = urlParams.get('session') || options.sessionId || 'default';
    this.token = urlParams.get('token') || options.token || null;
    this.market = options.market || 'us';
    this.panels = {};
    this.history = [];
    this.scale = null;
    this.reviewId = null;
    this.isAuthorized = Boolean(this.token);
    this.storageKey = `packsignal_scan_${this.sessionId}`;
    this.loadLocalCache();
    this.connect();
  }

  async connect() {
    try {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const deviceInfo = isMobile
        ? (navigator.userAgent.includes('iPhone') ? 'iPhone' : (navigator.userAgent.includes('Android') ? 'Android' : 'Mobile Browser'))
        : 'Web Viewfinder';
      const res = await fetch('/api/campus/mobile-session-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          token: this.token,
          deviceInfo: `${deviceInfo} · ${navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome') ? 'Safari' : 'Chrome/Brave'}`
        })
      });
      const result = await res.json();
      this.reviewId = result.reviewId || result.session?.reviewId || this.reviewId;
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  loadLocalCache() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const cached = JSON.parse(raw);
        this.panels = cached.panels || {};
        this.scale = cached.scale || null;
      }
    } catch (e) {
      // Local storage unreadable, continue with memory state
    }
  }

  saveLocalCache() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        sessionId: this.sessionId,
        panels: this.panels,
        scale: this.scale,
        updatedAt: new Date().toISOString(),
      }));
    } catch (e) {}
  }

  async uploadPanel(face, data) {
    const payload = {
      sessionId: this.sessionId,
      token: this.token,
      face,
      text: data.text || '',
      values: data.values || {},
      variance: data.variance || 135,
      corners: data.corners || null,
      cardBox: data.cardBox || null,
      hasGlare: Boolean(data.hasGlare),
      localOcr: data.localOcr || null,
      visionOcr: data.visionOcr || null,
      photoDataUrl: data.photoDataUrl || null,
      photoUrl: data.photoUrl || `/samples/campus/${face}.png`,
    };

    const res = await fetch('/api/campus/scan-panel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { 'X-Scan-Token': this.token } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Upload failed for panel ${face} (HTTP ${res.status})`);
    }

    const result = await res.json();
    this.panels[face] = result.panel;
    if (result.panel.scale?.valid) {
      this.scale = result.panel.scale;
    }
    this.saveLocalCache();
    return result;
  }

  async retakeFace(face) {
    const res = await fetch('/api/campus/scan-retake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: this.sessionId, face }),
    });
    const result = await res.json();
    delete this.panels[face];
    this.saveLocalCache();
    return result;
  }

  async adjustCorners(face, corners) {
    const res = await fetch('/api/campus/scan-corners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: this.sessionId, face, corners }),
    });
    const result = await res.json();
    if (this.panels[face]) {
      this.panels[face].unwarp = result.unwarp;
    }
    this.saveLocalCache();
    return result;
  }

  async requestCloseUp(face, targetContent, photoData) {
    const res = await fetch('/api/campus/scan-closeup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        face,
        targetContent,
        text: photoData?.text || '',
        photoUrl: photoData?.photoUrl || null,
      }),
    });
    return await res.json();
  }

  async generateBrief(options = {}) {
    const res = await fetch('/api/campus/scan-to-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        market: this.market,
        hasApprovedSpec: Boolean(options.hasApprovedSpec),
        isDraft: options.isDraft ?? true,
      }),
    });
    return await res.json();
  }

  async getStatus() {
    const res = await fetch(`/api/campus/scan-session?sessionId=${encodeURIComponent(this.sessionId)}`);
    if (!res.ok) throw new Error('Could not read the paired scan session.');
    const result = await res.json();
    this.reviewId = result.session?.reviewId || this.reviewId;
    return result;
  }

  clearSession() {
    this.panels = {};
    this.scale = null;
    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {}
  }
}
