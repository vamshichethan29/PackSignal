export function engineStatusCopy(status = {}) {
  const usage = status.aiUsage || {};
  const connection = status.aiConnection;
  const connectionCopy =
    connection === "verified"
      ? "The most recent live AI request completed successfully. Future availability can still vary."
      : connection === "configured"
        ? "AI provider credentials are configured. New reviews can use AI assistance; retries are bounded and configured alternate credentials may be tried."
        : connection === "running"
          ? "An AI request is running now."
          : connection === "attention"
            ? `The latest AI request needs attention (${usage.lastOutcome || "provider unavailable"}). Exact checks remain available.`
            : "Exact document comparisons are available. AI assistance is not configured on this server.";
  const seconds = Math.max(1, Math.round((Number(usage.minIntervalMs) || 6000) / 1000));
  const requestLimit = Math.max(1, Number(usage.maxRequestsPerMinute) || 5);
  const credentials = Math.max(0, Number(usage.configuredCredentials) || 0);
  const credentialLabel = credentials ? `${credentials} configured API key${credentials === 1 ? "" : "s"}` : "configured API keys";

  return {
    connection: connectionCopy,
    service: "PackSignal responded to this status check.",
    pacing: `Up to ${requestLimit} provider attempts per minute across ${credentialLabel}; at least ${seconds} seconds apart.`,
    failover:
      "Extra keys do not multiply a shared project quota. A 503 pauses the whole key pool; availability depends on Google’s project limits.",
    credentials: "Provider API keys stay on the server; the browser never receives them.",
    lastDispatch: `Last provider request: ${usage.lastOutcome || "No live request yet"}.`,
    cooldownUntil: usage.cooldownUntil || null,
    cooldownLabel: usage.cooldownScope === "provider"
      ? "Gemini is temporarily overloaded; the shared request pool is paused until"
      : usage.cooldownScope === "project"
        ? "Gemini’s shared project quota is paused until"
      : usage.cooldownScope === "credential"
        ? "A provider credential is cooling down until"
        : "The shared Gemini project quota is paused until",
    allowance:
      usage.remainingAttempts === 0
        ? "AI requests are paused for this session. Exact checks and cached AI results remain available."
        : "",
  };
}
