/**
 * content.js — GlowForge extension content script
 *
 * Injected into every page by manifest content_scripts declaration.
 * Listens for messages from background.js and executes tasks in the DOM.
 *
 * Actions handled:
 *   navigate   — wait and report final URL/title
 *   click      — find element by selector and click humanly
 *   type       — find element and type text humanly
 *   scrape     — extract data from DOM using selectors
 *   scroll_feed — scroll feed and collect post-like elements
 *   follow     — Twitter: find and click follow button
 *   like       — Twitter: find and click like button
 *   reply      — Twitter: open reply dialog and type response
 *
 * humanize.js is loaded before this script (see manifest content_scripts order).
 * Access via window.humanize (the singleton Humanizer instance).
 */

'use strict';

(function () {
  // Humanizer instance injected by humanize.js
  const h = window.humanize;

  if (!h) {
    console.error('[GlowForge/content] humanize.js not loaded — actions will fail');
    return;
  }

  // ── Action Handlers ─────────────────────────────────────────────────────

  const ACTIONS = {
    /** Report current page info after navigation settles. */
    async navigate(params) {
      await h.waitRandom(800, 2000);
      return {
        status: 'success',
        data: {
          title: document.title,
          url: window.location.href,
          readyState: document.readyState,
        },
      };
    },

    /** Click an element by CSS selector. */
    async click(params) {
      const { selector, timeout_ms = 10000 } = params;
      if (!selector) return { status: 'error', error: 'selector is required' };

      try {
        const el = await h.waitFor(selector, timeout_ms);
        await h.scrollToElement(el);
        await h.waitRandom(200, 600);
        await h.click(el);
        return { status: 'success', data: { clicked: selector } };
      } catch (err) {
        return { status: 'error', error: err.message };
      }
    },

    /** Type text into an element found by selector. */
    async type(params) {
      const { selector, text, timeout_ms = 10000, clear = true, with_mistakes = false } = params;
      if (!selector) return { status: 'error', error: 'selector is required' };
      if (!text) return { status: 'error', error: 'text is required' };

      try {
        await h.findAndType(selector, text, {
          timeoutMs: timeout_ms,
          clear,
          withMistakes: with_mistakes,
        });
        return { status: 'success', data: { typed: text.length + ' chars' } };
      } catch (err) {
        return { status: 'error', error: err.message };
      }
    },

    /**
     * Scrape data from DOM using a map of { key: selector }.
     * Returns { key: text|array } for each selector.
     */
    async scrape(params) {
      const { selectors = {}, multi = false } = params;
      const result = {};

      for (const [key, selector] of Object.entries(selectors)) {
        if (multi) {
          result[key] = Array.from(document.querySelectorAll(selector)).map(el => el.innerText?.trim());
        } else {
          const el = document.querySelector(selector);
          result[key] = el ? el.innerText?.trim() : null;
        }
      }

      return { status: 'success', data: result };
    },

    /**
     * Scroll the feed N times and collect post-like elements.
     * Works on Twitter/X by default; generic fallback collects <article> elements.
     */
    async scroll_feed(params) {
      const {
        scroll_times = 5,
        max_items = 50,
        collect = true,
        scroll_distance,
      } = params;

      const items = [];
      const seen = new Set();

      for (let i = 0; i < scroll_times; i++) {
        if (collect) {
          const batch = collectFeedItems();
          for (const item of batch) {
            const key = item.text || item.url || JSON.stringify(item);
            if (!seen.has(key)) {
              seen.add(key);
              items.push(item);
            }
          }
        }

        await h.scrollDown(scroll_distance);
        await h.waitRandom(800, 2000);

        // Occasional micro-pause
        if (Math.random() < 0.3) {
          await h.idleWiggle(rand(500, 1500));
        }
      }

      return {
        status: 'success',
        data: {
          items: items.slice(0, max_items),
          total_collected: items.length,
          scroll_times,
        },
      };
    },

    // ── Twitter-specific actions ──────────────────────────────────────────

    /** Like a tweet on the current page (navigate to tweet_url first). */
    async like(params) {
      const { tweet_url, sandbox = false } = params;

      // Check if already liked
      const unlikeBtn = document.querySelector('[data-testid="unlike"]');
      if (unlikeBtn) return { status: 'success', data: { already_liked: true } };

      try {
        const likeBtn = await h.waitFor('[data-testid="like"]', 8000);
        if (sandbox) return { status: 'success', data: { sandbox: true } };

        await h.scrollToElement(likeBtn);
        await h.waitRandom(500, 1500);
        await h.click(likeBtn);
        await h.waitRandom(1000, 2500);

        return { status: 'success', data: { liked: tweet_url || window.location.href } };
      } catch (err) {
        return { status: 'error', error: err.message };
      }
    },

    /** Follow a user on Twitter (navigate to their profile first). */
    async follow(params) {
      const { handle, sandbox = false } = params;
      if (!handle) return { status: 'error', error: 'handle is required' };

      const cleanHandle = handle.replace(/^@/, '');

      // Check already following
      const followingBtns = document.querySelectorAll('[data-testid="placementTracking"]');
      for (const btn of followingBtns) {
        if (btn.innerText.includes('Following')) {
          return { status: 'success', data: { already_following: true, handle } };
        }
      }

      try {
        // Try aria-label first
        let followBtn = document.querySelector(`[aria-label="Follow @${cleanHandle}"]`);
        if (!followBtn) {
          for (const btn of followingBtns) {
            if (btn.innerText.trim() === 'Follow') {
              followBtn = btn;
              break;
            }
          }
        }

        if (!followBtn) {
          return { status: 'error', error: `Follow button not found for @${cleanHandle}` };
        }

        if (sandbox) return { status: 'success', data: { sandbox: true, handle } };

        await h.scrollToElement(followBtn);
        await h.waitRandom(500, 1200);
        await h.click(followBtn);
        await h.waitRandom(1500, 3500);

        return { status: 'success', data: { followed: `@${cleanHandle}` } };
      } catch (err) {
        return { status: 'error', error: err.message };
      }
    },

    /**
     * Reply to a tweet. Task should have navigated to tweet_url already.
     * params: { reply_text, sandbox }
     */
    async reply(params) {
      const { reply_text, sandbox = false } = params;
      if (!reply_text) return { status: 'error', error: 'reply_text is required' };

      try {
        // Brief dwell to look human
        await h.idleWiggle(rand(1000, 2500));

        const replyBtn = await h.waitFor('[data-testid="reply"]', 8000);
        await h.click(replyBtn);
        await h.waitRandom(1500, 3500);

        const compose = await h.waitFor('[data-testid="tweetTextarea_0"]', 8000);
        await h.click(compose);
        await h.waitRandom(400, 900);
        await h.type(compose, reply_text, { withMistakes: true });

        await h.waitRandom(800, 2000);

        if (sandbox) {
          // Press Escape instead of posting
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          return { status: 'success', data: { sandbox: true, reply_text } };
        }

        // Find and click post button
        let postBtn = document.querySelector('[data-testid="tweetButton"]');
        if (!postBtn) postBtn = document.querySelector('[data-testid="tweetButtonInline"]');

        if (!postBtn || postBtn.getAttribute('aria-disabled') === 'true') {
          return { status: 'error', error: 'Post button not found or disabled' };
        }

        await h.scrollToElement(postBtn);
        await h.waitRandom(300, 700);
        await h.click(postBtn);
        await h.waitRandom(2000, 4000);

        return { status: 'success', data: { replied: true, text: reply_text.slice(0, 50) } };
      } catch (err) {
        return { status: 'error', error: err.message };
      }
    },
  };

  // ── Feed Item Collection (Twitter + generic) ────────────────────────────

  const EXTRACT_POSTS_JS = () => {
    function parseAriaCount(el) {
      if (!el) return 0;
      const m = (el.getAttribute('aria-label') || '').match(/(\d[\d,]*)/);
      return m ? parseInt(m[1].replace(',', ''), 10) : 0;
    }

    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    if (articles.length > 0) {
      return Array.from(articles).map(article => {
        const userEl = article.querySelector('[data-testid="User-Name"]');
        const textEl = article.querySelector('[data-testid="tweetText"]');
        const timeEl = article.querySelector('time');
        const linkEl = timeEl ? timeEl.closest('a') : null;
        const replyBtn = article.querySelector('[data-testid="reply"]');
        const retweetBtn = article.querySelector('[data-testid="retweet"]');
        const likeBtn = article.querySelector('[data-testid="like"]');

        let handle = '';
        if (userEl) {
          for (const a of userEl.querySelectorAll('a')) {
            const href = a.getAttribute('href');
            if (href && href.startsWith('/') && !href.includes('/status/')) {
              handle = '@' + href.slice(1);
              break;
            }
          }
        }

        return {
          handle,
          author: userEl ? userEl.innerText.split('\n')[0] : '',
          text: textEl ? textEl.innerText : '',
          time: timeEl ? timeEl.getAttribute('datetime') : '',
          url: linkEl ? 'https://x.com' + linkEl.getAttribute('href') : '',
          replies: parseAriaCount(replyBtn),
          retweets: parseAriaCount(retweetBtn),
          likes: parseAriaCount(likeBtn),
        };
      });
    }

    // Generic fallback: collect <article> elements
    return Array.from(document.querySelectorAll('article')).map(a => ({
      text: a.innerText.slice(0, 500).trim(),
      url: (a.querySelector('a') || {}).href || '',
    }));
  };

  function collectFeedItems() {
    try {
      return EXTRACT_POSTS_JS();
    } catch {
      return [];
    }
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  // ── Message Listener ────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const handler = ACTIONS[msg.action];

    if (!handler) {
      sendResponse({ status: 'error', error: `Unknown action: ${msg.action}` });
      return true;
    }

    handler(msg.params || {})
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ status: 'error', error: err.message }));

    return true; // async response
  });

  console.log('[GlowForge/content] Ready on', window.location.hostname);
})();
