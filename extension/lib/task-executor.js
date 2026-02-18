/**
 * task-executor.js — Task dispatch layer for GlowForge extension
 *
 * background.js calls execute(task, tabId) to run a task in a tab.
 * Sends a message to the content script and waits for the result.
 *
 * Supported actions: navigate, scroll_feed, click, type, scrape,
 *   screenshot, follow, like, reply (Twitter)
 */

'use strict';

const CONTENT_SCRIPT_TIMEOUT_MS = 60_000; // 60s max per task

/**
 * Execute a task in the given tab by messaging the content script.
 * Returns a result object: { status, data?, error? }
 */
export async function executeTask(task, tabId) {
  const { action, params = {}, target_url } = task;

  // Navigate the tab to target_url if provided
  if (target_url) {
    await navigateTab(tabId, target_url);
  }

  // Special case: screenshot is handled in background without content script
  if (action === 'screenshot') {
    return handleScreenshot(tabId, params);
  }

  // All other actions: delegate to content script
  return sendToContentScript(tabId, { action, params });
}

/**
 * Navigate a tab to a URL and wait for it to settle.
 */
async function navigateTab(tabId, url) {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, { url }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      // Wait for tab to complete loading
      function onUpdated(id, changeInfo) {
        if (id === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          // Give page JS a moment to settle
          setTimeout(resolve, 1500);
        }
      }

      chrome.tabs.onUpdated.addListener(onUpdated);

      // Timeout fallback
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve(); // proceed anyway
      }, 20_000);
    });
  });
}

/**
 * Capture a screenshot of a tab using chrome.tabs.captureVisibleTab.
 */
async function handleScreenshot(tabId, params) {
  return new Promise((resolve) => {
    const windowId = chrome.windows?.WINDOW_ID_CURRENT;
    chrome.tabs.get(tabId, (tab) => {
      chrome.tabs.captureVisibleTab(
        tab.windowId,
        { format: 'png' },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            resolve({ status: 'error', error: chrome.runtime.lastError.message });
          } else {
            resolve({
              status: 'success',
              data: { screenshot: dataUrl, format: 'png' },
            });
          }
        },
      );
    });
  });
}

/**
 * Send an action message to the content script in tabId and await response.
 */
function sendToContentScript(tabId, message) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ status: 'error', error: 'Content script timeout' });
    }, CONTENT_SCRIPT_TIMEOUT_MS);

    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          resolve({ status: 'error', error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { status: 'error', error: 'No response from content script' });
        }
      });
    } catch (err) {
      clearTimeout(timer);
      resolve({ status: 'error', error: err.message });
    }
  });
}
