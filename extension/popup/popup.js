/**
 * popup.js — GlowForge extension popup controller
 *
 * Communicates with background.js via chrome.runtime.sendMessage.
 * Handles: URL config, enable/disable toggle, connection test, live stats.
 */

'use strict';

// ─── Elements ──────────────────────────────────────────────────────────────

const urlInput = document.getElementById('url-input');
const urlError = document.getElementById('url-error');
const btnSave = document.getElementById('btn-save');
const btnTest = document.getElementById('btn-test');
const enabledToggle = document.getElementById('enabled-toggle');

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const pendingBadge = document.getElementById('pending-badge');

const statCompleted = document.getElementById('stat-completed');
const statFailed = document.getElementById('stat-failed');
const statTabs = document.getElementById('stat-tabs');
const statPending = document.getElementById('stat-pending');
const lastPollEl = document.getElementById('last-poll');

// ─── Helpers ───────────────────────────────────────────────────────────────

function sendMsg(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, (resp) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(resp || {});
      }
    });
  });
}

function setStatus(connected, text, pending = 0) {
  statusDot.className = 'dot ' + (connected ? 'connected' : 'disconnected');
  statusText.textContent = text;

  if (connected && pending > 0) {
    pendingBadge.style.display = '';
    pendingBadge.textContent = pending + ' pending';
  } else {
    pendingBadge.style.display = 'none';
  }
}

function showError(msg) {
  urlError.textContent = msg;
  urlError.style.display = msg ? '' : 'none';
  urlInput.classList.toggle('error', !!msg);
}

function relativeTime(ts) {
  if (!ts) return 'never';
  const secs = Math.round((Date.now() - ts) / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return secs + 's ago';
  return Math.round(secs / 60) + 'm ago';
}

function normalizeUrl(raw) {
  raw = raw.trim().replace(/\/$/, '');
  if (!raw) return '';
  if (!raw.startsWith('http')) raw = 'http://' + raw;
  return raw;
}

// ─── Load State from Background ────────────────────────────────────────────

async function refreshStatus() {
  const resp = await sendMsg('GET_STATUS');
  if (!resp || !resp.stats) return;

  const { config, stats, managedTabs } = resp;

  // Populate URL input
  if (config.glowforgeUrl && !urlInput.value) {
    urlInput.value = config.glowforgeUrl;
  }

  // Toggle state
  enabledToggle.checked = config.enabled !== false;

  // Status dot + text
  if (stats.connected) {
    setStatus(true, 'Connected — polling every 5s', stats.pendingCount);
  } else if (config.glowforgeUrl) {
    const errMsg = stats.lastError ? `Error: ${stats.lastError}` : 'Disconnected';
    setStatus(false, errMsg, 0);
  } else {
    setStatus(false, 'No URL configured', 0);
  }

  // Stats
  statCompleted.textContent = stats.tasksCompleted ?? 0;
  statFailed.textContent = stats.tasksFailed ?? 0;
  statTabs.textContent = managedTabs ?? 0;
  statPending.textContent = stats.pendingCount ?? '—';
  lastPollEl.textContent = 'Last poll: ' + relativeTime(stats.lastPoll);
}

// ─── Event Handlers ────────────────────────────────────────────────────────

btnSave.addEventListener('click', async () => {
  const url = normalizeUrl(urlInput.value);

  if (!url) {
    showError('Enter a GlowForge URL (e.g. http://localhost:5274)');
    return;
  }

  showError('');
  btnSave.textContent = 'Saving…';
  btnSave.disabled = true;

  const resp = await sendMsg('SET_CONFIG', {
    config: {
      glowforgeUrl: url,
      enabled: enabledToggle.checked,
    },
  });

  btnSave.textContent = 'Save & Connect';
  btnSave.disabled = false;
  urlInput.value = url;

  if (resp.ok) {
    setStatus(false, 'Config saved — connecting…', 0);
    setTimeout(refreshStatus, 2000);
  } else {
    showError(resp.error || 'Failed to save config');
  }
});

btnTest.addEventListener('click', async () => {
  const url = normalizeUrl(urlInput.value);
  if (!url) {
    showError('Enter a URL first');
    return;
  }

  // Save URL first so background can use it
  await sendMsg('SET_CONFIG', { config: { glowforgeUrl: url } });

  showError('');
  btnTest.textContent = 'Testing…';
  btnTest.disabled = true;

  const resp = await sendMsg('TEST_CONNECTION');

  btnTest.textContent = 'Test';
  btnTest.disabled = false;

  if (resp.ok) {
    setStatus(true, 'Connected ✓', resp.status?.pending ?? 0);
    showError('');
  } else {
    setStatus(false, 'Connection failed', 0);
    showError(resp.error || 'Could not reach GlowForge');
  }
});

enabledToggle.addEventListener('change', async () => {
  const url = normalizeUrl(urlInput.value);
  await sendMsg('SET_CONFIG', {
    config: {
      glowforgeUrl: url || undefined,
      enabled: enabledToggle.checked,
    },
  });

  statusText.textContent = enabledToggle.checked
    ? 'Polling enabled'
    : 'Polling paused';
});

// ─── Init ──────────────────────────────────────────────────────────────────

refreshStatus();

// Refresh every 3 seconds while popup is open
setInterval(refreshStatus, 3000);
