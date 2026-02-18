/**
 * humanize.js — Human-like browser interactions for GlowForge extension
 *
 * Ported from ~/tools/browser/human/ (mouse.py, scroll.py, keyboard.py)
 * Provides: Bezier mouse curves, natural scroll, typing cadence, idle behavior
 *
 * Usage in content scripts:
 *   const h = new Humanizer();
 *   await h.moveTo(x, y);
 *   await h.click(x, y);
 *   await h.typeText(el, "hello world");
 *   await h.scroll(500);
 */

'use strict';

// ─── Utilities ────────────────────────────────────────────────────────────────

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// ─── Bezier Curves ────────────────────────────────────────────────────────────

class BezierCurve {
  /**
   * De Casteljau's algorithm — works for any number of control points.
   */
  static decasteljau(points, t) {
    if (points.length === 1) return points[0];
    const next = [];
    for (let i = 0; i < points.length - 1; i++) {
      next.push({
        x: (1 - t) * points[i].x + t * points[i + 1].x,
        y: (1 - t) * points[i].y + t * points[i + 1].y,
      });
    }
    return BezierCurve.decasteljau(next, t);
  }

  /** Ease-in-out for natural acceleration/deceleration */
  static easeInOut(t) {
    if (t < 0.5) return 2 * t * t;
    return 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  /**
   * Generate cubic Bezier control points between two positions.
   * Creates a slight arc with random variation.
   */
  static generateControlPoints(start, end, variation = 0.3) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) return [start, end];

    // Perpendicular offset for arc
    const perpX = -dy / dist;
    const perpY = dx / dist;
    const maxOff = Math.min(dist * 0.4, 100);

    const off1 = rand(-maxOff, maxOff) * variation;
    const off2 = rand(-maxOff, maxOff) * variation;

    return [
      start,
      { x: start.x + dx * 0.25 + perpX * off1, y: start.y + dy * 0.25 + perpY * off1 },
      { x: start.x + dx * 0.75 + perpX * off2, y: start.y + dy * 0.75 + perpY * off2 },
      end,
    ];
  }

  /**
   * Generate a path of N points along the Bezier curve.
   */
  static generatePath(start, end, numPoints = 20, variation = 0.3) {
    if (numPoints < 2) return [start, end];
    const cps = BezierCurve.generateControlPoints(start, end, variation);
    const path = [];
    for (let i = 0; i < numPoints; i++) {
      const t = BezierCurve.easeInOut(i / (numPoints - 1));
      path.push(BezierCurve.decasteljau(cps, t));
    }
    return path;
  }
}

// ─── Mouse Controller ─────────────────────────────────────────────────────────

class MouseController {
  constructor() {
    this.currentX = window.innerWidth / 2;
    this.currentY = window.innerHeight / 2;
  }

  /**
   * Dispatch a synthetic mousemove event at (x, y).
   */
  _dispatchMove(x, y) {
    const el = document.elementFromPoint(x, y) || document.body;
    el.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true, cancelable: true, view: window,
      clientX: x, clientY: y, screenX: x, screenY: y,
    }));
    this.currentX = x;
    this.currentY = y;
  }

  _dispatchOver(x, y) {
    const el = document.elementFromPoint(x, y) || document.body;
    el.dispatchEvent(new MouseEvent('mouseover', {
      bubbles: true, cancelable: true, view: window,
      clientX: x, clientY: y,
    }));
  }

  /**
   * Move mouse from current position to (tx, ty) along a Bezier path.
   */
  async moveTo(tx, ty, opts = {}) {
    const { steps, variation = 0.35, delayMs = [4, 12] } = opts;
    const start = { x: this.currentX, y: this.currentY };
    const end = { x: tx, y: ty };

    const dist = Math.sqrt((tx - start.x) ** 2 + (ty - start.y) ** 2);
    if (dist < 1) return;

    const numSteps = steps || clamp(Math.round(dist / 8), 8, 60);
    const path = BezierCurve.generatePath(start, end, numSteps, variation);

    // Optional overshoot
    const overshootChance = 0.2;
    if (Math.random() < overshootChance && dist > 50) {
      const dx = tx - start.x, dy = ty - start.y;
      const ovLen = dist * rand(0.04, 0.12);
      const ovX = tx + (dx / dist) * ovLen;
      const ovY = ty + (dy / dist) * ovLen;
      const ovPath = BezierCurve.generatePath(end, { x: ovX, y: ovY }, 5, 0.1);
      const corrPath = BezierCurve.generatePath({ x: ovX, y: ovY }, end, 4, 0.1);
      path.push(...ovPath, ...corrPath);
    }

    for (const pt of path) {
      this._dispatchMove(Math.round(pt.x), Math.round(pt.y));
      await sleep(rand(...delayMs));
    }

    this._dispatchOver(tx, ty);
  }

  /**
   * Move to element center using bounding rect, with Bezier path.
   */
  async moveToElement(el) {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2 + rand(-rect.width * 0.1, rect.width * 0.1);
    const y = rect.top + rect.height / 2 + rand(-rect.height * 0.1, rect.height * 0.1);
    await this.moveTo(x, y);
  }

  /**
   * Simulate a human click: move → hover → mousedown → mouseup → click.
   */
  async click(el, opts = {}) {
    await this.moveToElement(el);
    await sleep(rand(80, 250)); // hover pause

    const rect = el.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);

    const evOpts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };

    el.dispatchEvent(new MouseEvent('mousedown', { ...evOpts, button: 0, buttons: 1 }));
    await sleep(rand(50, 150));
    el.dispatchEvent(new MouseEvent('mouseup', { ...evOpts, button: 0, buttons: 0 }));
    el.dispatchEvent(new MouseEvent('click', { ...evOpts, button: 0 }));

    this.currentX = x;
    this.currentY = y;
  }

  /**
   * Micro-movements to simulate idle presence at current position.
   */
  async idleWiggle(durationMs = 1500) {
    const end = Date.now() + durationMs;
    while (Date.now() < end) {
      const dx = rand(-4, 4);
      const dy = rand(-4, 4);
      this._dispatchMove(
        clamp(this.currentX + dx, 0, window.innerWidth),
        clamp(this.currentY + dy, 0, window.innerHeight),
      );
      await sleep(rand(120, 400));
    }
  }
}

// ─── Scroll Controller ────────────────────────────────────────────────────────

class ScrollController {
  constructor() {
    this.baseSpeed = 380; // px per "step"
    this.smoothSteps = 12;
  }

  /**
   * Smooth scroll by delta pixels with ease-in-out.
   */
  async scroll(deltaY, smooth = true) {
    if (!smooth) {
      window.scrollBy(0, deltaY);
      return;
    }

    const steps = this.smoothSteps;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const ease = BezierCurve.easeInOut(t);
      const stepDelta = (deltaY * ease) / steps;
      window.scrollBy({ top: stepDelta, behavior: 'instant' });
      await sleep(rand(12, 28));
    }
  }

  /**
   * Scroll down a natural distance with reading pause.
   */
  async scrollDown(distance) {
    const dist = distance || this._naturalDistance();
    await this.scroll(dist);
    await sleep(rand(500, 2000)); // reading pause
  }

  /**
   * Scroll up a natural distance.
   */
  async scrollUp(distance) {
    const dist = distance || this._naturalDistance();
    await this.scroll(-dist);
    await sleep(rand(300, 1000));
  }

  /**
   * Scroll element into view with human-like behavior.
   */
  async scrollToElement(el) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await sleep(rand(800, 1600));
  }

  /**
   * Natural scroll distance: viewport-relative with variance.
   */
  _naturalDistance() {
    const base = window.innerHeight * rand(0.3, 0.75);
    return clamp(base, 150, 900);
  }

  /**
   * Scroll with momentum (touch-like deceleration).
   */
  async scrollMomentum(initialSpeed = 400, deceleration = 0.85) {
    let speed = initialSpeed;
    while (speed > 50) {
      await this.scroll(speed, false);
      speed *= deceleration;
      await sleep(rand(30, 60));
    }
  }
}

// ─── Keyboard Controller ──────────────────────────────────────────────────────

const PUNCTUATION = new Set('.,;:!?-()[]{}"\' `~@#$%^&*+=|\\/<>');
const SENTENCE_ENDERS = new Set('.!?');

// QWERTY rows for typo simulation
const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

function getNearbyKey(char) {
  const lower = char.toLowerCase();
  for (const row of KEYBOARD_ROWS) {
    const idx = row.indexOf(lower);
    if (idx >= 0) {
      const neighbors = [];
      if (idx > 0) neighbors.push(row[idx - 1]);
      if (idx < row.length - 1) neighbors.push(row[idx + 1]);
      if (!neighbors.length) return lower;
      const picked = neighbors[Math.floor(Math.random() * neighbors.length)];
      return char === char.toUpperCase() ? picked.toUpperCase() : picked;
    }
  }
  return char;
}

class KeyboardController {
  constructor() {
    this.baseDelay = 65;       // ms base between keystrokes
    this.speedVariation = 0.4; // ±40%
    this.mistakeChance = 0.03; // 3% per character
  }

  /**
   * Calculate per-character typing delay with natural variance.
   */
  _charDelay(char) {
    const variation = rand(-this.speedVariation, this.speedVariation);
    let delay = this.baseDelay * (1 + variation);
    if (PUNCTUATION.has(char)) delay *= 1.6;
    if (SENTENCE_ENDERS.has(char)) delay *= 1.4;
    if (char === ' ') delay *= 1.2;
    return clamp(delay, 25, 220);
  }

  /**
   * Type a single character into an element using input events.
   */
  async _typeChar(el, char) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));

    // Use execCommand for contenteditable, value assignment for inputs
    if (el.isContentEditable) {
      document.execCommand('insertText', false, char);
    } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      el.value = el.value.slice(0, start) + char + el.value.slice(end);
      el.selectionStart = el.selectionEnd = start + 1;
    }

    el.dispatchEvent(new InputEvent('input', { data: char, inputType: 'insertText', bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
  }

  async _deleteChar(el) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    if (el.isContentEditable) {
      document.execCommand('delete', false);
    } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const start = el.selectionStart;
      if (start > 0) {
        el.value = el.value.slice(0, start - 1) + el.value.slice(start);
        el.selectionStart = el.selectionEnd = start - 1;
      }
    }
    el.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', bubbles: true }));
  }

  /**
   * Type text into an element with human-like delays and optional mistakes.
   */
  async typeText(el, text, opts = {}) {
    const { withMistakes = false } = opts;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const delay = this._charDelay(char);

      // Possible typo
      if (withMistakes && Math.random() < this.mistakeChance && /[a-zA-Z]/.test(char)) {
        const wrong = getNearbyKey(char);
        await this._typeChar(el, wrong);
        await sleep(rand(200, 600)); // realization pause
        await this._deleteChar(el);
        await sleep(rand(50, 120));
      }

      await this._typeChar(el, char);
      await sleep(delay);

      // Occasional thinking pauses mid-sentence
      if (Math.random() < 0.03) {
        await sleep(rand(400, 1200));
      }
    }
  }

  /**
   * Clear field contents and type replacement text.
   */
  async fillField(el, text, opts = {}) {
    el.focus();
    await sleep(rand(100, 300));

    // Select all + delete
    if (el.isContentEditable) {
      document.execCommand('selectAll', false);
      document.execCommand('delete', false);
    } else {
      el.select();
      el.value = '';
    }
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await sleep(rand(100, 200));

    await this.typeText(el, text, opts);
  }
}

// ─── Humanizer (Facade) ───────────────────────────────────────────────────────

/**
 * Humanizer: top-level interface used by content.js and task-executor.js.
 *
 * const h = new Humanizer();
 * await h.click(el);
 * await h.type(el, "hello");
 * await h.scrollDown(400);
 */
class Humanizer {
  constructor() {
    this.mouse = new MouseController();
    this.scroll = new ScrollController();
    this.keyboard = new KeyboardController();
  }

  // Mouse
  async moveTo(x, y, opts) { return this.mouse.moveTo(x, y, opts); }
  async moveToElement(el) { return this.mouse.moveToElement(el); }
  async click(el) { return this.mouse.click(el); }
  async idleWiggle(ms) { return this.mouse.idleWiggle(ms); }

  // Scroll
  async scrollDown(px) { return this.scroll.scrollDown(px); }
  async scrollUp(px) { return this.scroll.scrollUp(px); }
  async scrollToElement(el) { return this.scroll.scrollToElement(el); }
  async scrollMomentum(speed, decel) { return this.scroll.scrollMomentum(speed, decel); }

  // Keyboard
  async type(el, text, opts) { return this.keyboard.typeText(el, text, opts); }
  async fill(el, text, opts) { return this.keyboard.fillField(el, text, opts); }

  // Utility
  async wait(ms) { return sleep(ms); }
  async waitRandom(min, max) { return sleep(rand(min, max)); }

  /**
   * Wait for an element matching selector to appear, up to timeoutMs.
   */
  async waitFor(selector, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const el = document.querySelector(selector);
      if (el) return el;
      await sleep(200);
    }
    throw new Error(`Timeout waiting for: ${selector}`);
  }

  /**
   * Find element by selector and click it with human behavior.
   */
  async findAndClick(selector, timeoutMs = 10000) {
    const el = await this.waitFor(selector, timeoutMs);
    await this.scrollToElement(el);
    await this.waitRandom(200, 600);
    await this.click(el);
    return el;
  }

  /**
   * Find element and type into it with human behavior.
   */
  async findAndType(selector, text, opts = {}) {
    const el = await this.waitFor(selector, opts.timeoutMs || 10000);
    await this.scrollToElement(el);
    await this.waitRandom(100, 300);
    el.focus();
    if (opts.clear !== false) {
      await this.keyboard.fillField(el, text, opts);
    } else {
      await this.keyboard.typeText(el, text, opts);
    }
    return el;
  }
}

// Export for use as content script (window global) and as module
if (typeof window !== 'undefined') {
  window.Humanizer = Humanizer;
  window.humanize = new Humanizer();
}

// For module contexts (background.js imports)
if (typeof module !== 'undefined') {
  module.exports = { Humanizer, BezierCurve, MouseController, ScrollController, KeyboardController };
}
