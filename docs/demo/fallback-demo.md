# Fallback Demo Strategy & Offline Presentation

## Purpose
In high-stakes live hackathon judging environments, network latency, server restarts, or conference Wi-Fi outages can disrupt live network requests. PackSignal provides a rock-solid, fully authentic fallback workflow that adheres strictly to truthfulness standards.

---

## 1. Mode B: Previously Verified Review

When presenting with limited time or when running without starting a fresh background analysis:
1. Click **`[Reveal with PackSignal]`**.
2. Select **`Mode B: Open Previously Verified Review`**.
3. PackSignal loads the completed Dancing Fish organizer review directly from local workspace storage.

### Truth in Advertising Requirements:
- The presentation displays **`[Verified Previous Run]`** rather than "Live fresh scan".
- The original recorded timestamp and SHA-256 source hashes are displayed.
- The recorded processing time from the prior run is displayed with a `(Precomputed)` label.
- No simulated fake progress bars or artificial delays are injected.

---

## 2. Completely Offline / Disconnected Environment

If the Node.js backend server (`server.mjs`) is stopped or network ports are blocked:
1. Presentation Mode detects the network disconnection gracefully.
2. The UI falls back to the client-side precomputed verification dataset built from the official organizer files.
3. The badge updates to **`[Offline Verified Artifact]`**.
4. All 16 candidate checks, positive control P01, artwork bounding boxes, and statutory citations remain fully interactive.
5. Presenters can honestly state:
   > "Because PackSignal produces self-contained, tamper-evident JSON inspection certificates signed with Ed25519, the entire verification report and proof chain can be audited completely offline without network access."
