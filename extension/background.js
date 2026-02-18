/**
 * background.js — GlowForge extension service worker
 *
 * Responsibilities:
 * - Polls /api/browser/tasks every 5s (via chrome.alarms)
 * - Manages a tab pool (opens/reuses/closes tabs per task)
 * - Dispatches tasks to content.js via task-executor.js
 * - Posts results back to /api/browser/results/{id}
 *
 * Config lives in chrome.storage.local:
 *   { glowforgeUrl: 'http://localhost:5274', enabled: true }
 */

'use strict';

import { QueueClient } from './lib/queue-client.js';
import { executeTask } from './lib/task-executor.js';

// ─── State ─────────────────────────────────────────────────────────────────

let config = { glowforgeUrl: '', enabled: false };
let client = null;
let isRunning = false; // prevent concurrent task execution

// Track managed tabs: tabId → { taskId, url, createdAt }
const managedTabs = new Map();

// Stats for popup display
const stats = {
  connected: false,
  pendingCount: 0,
  tasksCompleted: 0,
  tasksFailed: 0,
  lastPoll: null,
  lastError: null,
};

// ─── Init ──────────────────────────────────────────────────────────────────

async function init() {
  const stored = await chrome.storage.local.get(['glowforgeUrl', 'enabled']);
  config.glowforgeUrl = stored.glowforgeUrl || '';
  config.enabled = stored.enabled !== false; // default true once URL is set

  if (config.glowforgeUrl) {
    client = new QueueClient(config.glowforgeUrl);
  }

  // Set up polling alarm (every 5 seconds — minimum chrome allows is 1 min,
  // so we use a repeating alarm at 1 min and supplement with setTimeout in
  // the alarm handler for sub-minute polling)
  setupAlarm();
  console.log('[GlowForge] Background worker initialized', config);
}

function setupAlarm() {
  chrome.alarms.clearAll(() => {
    // Chrome alarms minimum is 1 minute; we use it as a keep-alive
    // and drive actual 5s polling via setTimeout inside onAlarm
    chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
  });
}

// ─── Polling Loop ───────────────────────────────────────────────────────────

let _pollTimer = null;

function startPolling() {
  if (_pollTimer) return;
  _pollTimer = setTimeout(pollLoop, 0);
}

function stopPolling() {
  if (_pollTimer) {
    clearTimeout(_pollTimer);
    _pollTimer = null;
  }
}

async function pollLoop() {
  _pollTimer = null;

  if (!config.enabled || !client) {
    _pollTimer = setTimeout(pollLoop, 10_000);
    return;
  }

  await poll();

  // Schedule next poll: 5s when connected, 15s on error
  const delay = stats.connected ? 5_000 : 15_000;
  _pollTimer = setTimeout(pollLoop, delay);
}

async function poll() {
  stats.lastPoll = Date.now();

  // Check queue status (for popup badge)
  try {
    const queueStatus = await client.fetchQueueStatus();
    if (queueStatus !== null) {
      stats.connected = true;
      stats.pendingCount = queueStatus.pending ?? 0;
      stats.lastError = null;
      updateBadge();
    } else {
      // Server might be up but /queue not yet implemented; still try tasks
      stats.connected = true;
    }
  } catch {
    // ignore queue status errors; task fetch will reveal connectivity
  }

  if (isRunning) return; // don't fetch while a task is executing

  const task = await client.fetchTask();

  if (!task) {
    const err = client.lastError;
    if (err) {
      stats.connected = false;
      stats.lastError = err;
      updateBadge();
    }
    return;
  }

  stats.connected = true;
  await runTask(task);
}

// ─── Task Runner ────────────────────────────────────────────────────────────

async function runTask(task) {
  isRunning = true;
  console.log(`[GlowForge] Running task: ${task.id} action=${task.action}`);

  let tabId = null;
  let result;

  try {
    // Open or reuse a tab
    tabId = await getOrOpenTab(task);

    // Execute the task
    result = await executeTask(task, tabId);

    stats.tasksCompleted++;
    console.log(`[GlowForge] Task ${task.id} complete:`, result.status);
  } catch (err) {
    result = { status: 'error', error: err.message };
    stats.tasksFailed++;
    console.error(`[GlowForge] Task ${task.id} threw:`, err);
  } finally {
    isRunning = false;
  }

  // Post result
  await client.postResult(task.id, result);

  // Clean up tab if we opened it (unless task wants to keep it)
  if (tabId !== null && managedTabs.has(tabId)) {
    const tabMeta = managedTabs.get(tabId);
    if (!task.params?.keep_tab) {
      managedTabs.delete(tabId);
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        // Tab may have closed itself
      }
    }
  }

  updateBadge();
}

// ─── Tab Management ─────────────────────────────────────────────────────────

/**
 * Return a suitable tab for executing the task.
 * - Reuses an existing managed tab for the same origin if possible.
 * - Otherwise opens a new background tab.
 */
async function getOrOpenTab(task) {
  const { target_url } = task;

  // Try to reuse an existing managed tab for same origin
  if (target_url) {
    const origin = new URL(target_url).origin;
    for (const [tabId, meta] of managedTabs) {
      if (meta.origin === origin) {
        // Verify tab still exists
        try {
          await chrome.tabs.get(tabId);
          return tabId; // reuse
        } catch {
          managedTabs.delete(tabId);
        }
      }
    }
  }

  // Open a new tab
  const tab = await chrome.tabs.create({
    url: target_url || 'about:blank',
    active: false, // background tab
  });

  managedTabs.set(tab.id, {
    taskId: task.id,
    origin: target_url ? new URL(target_url).origin : null,
    createdAt: Date.now(),
  });

  // Wait for tab to finish loading
  await waitForTabLoad(tab.id);

  return tab.id;
}

/**
 * Wait for tab to reach 'complete' status, up to 20s.
 */
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 20_000);

    function onUpdated(id, changeInfo) {
      if (id === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        clearTimeout(timer);
        setTimeout(resolve, 800); // settle pause
      }
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

// ─── Badge ─────────────────────────────────────────────────────────────────

function updateBadge() {
  if (stats.connected) {
    chrome.action.setBadgeText({ text: stats.pendingCount > 0 ? String(stats.pendingCount) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' }); // green
  } else {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' }); // red
  }
}

// ─── Message Handling (from popup) ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_STATUS') {
    sendResponse({ config, stats, managedTabs: managedTabs.size });
    return true;
  }

  if (msg.type === 'SET_CONFIG') {
    Object.assign(config, msg.config);
    chrome.storage.local.set({
      glowforgeUrl: config.glowforgeUrl,
      enabled: config.enabled,
    });

    if (config.glowforgeUrl) {
      client = new QueueClient(config.glowforgeUrl);
      if (config.enabled) startPolling();
      else stopPolling();
    }

    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'TEST_CONNECTION') {
    if (!client) {
      sendResponse({ ok: false, error: 'No URL configured' });
      return true;
    }
    client.fetchQueueStatus().then((status) => {
      if (status !== null) {
        stats.connected = true;
        updateBadge();
        sendResponse({ ok: true, status });
      } else {
        stats.connected = false;
        sendResponse({ ok: false, error: client.lastError || 'No response' });
      }
    });
    return true; // async
  }

  return false;
});

// ─── Alarm keep-alive ───────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Service workers are kept alive by this alarm; polling is managed by setTimeout
    if (!_pollTimer && config.enabled && client) {
      startPolling();
    }
  }
});

// ─── Tab cleanup on close ───────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
  managedTabs.delete(tabId);
});

// ─── Boot ─────────────────────────────────────────────────────────────────

init().then(() => {
  if (config.enabled && config.glowforgeUrl) {
    startPolling();
  }
});
