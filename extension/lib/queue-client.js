/**
 * queue-client.js — Task queue polling and result posting for GlowForge extension
 *
 * Polls GET /api/browser/tasks to get the next task.
 * Posts results to POST /api/browser/results/{id}.
 * Respects TTL: skips expired tasks with status "expired".
 */

'use strict';

export class QueueClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this._lastError = null;
  }

  /**
   * Fetch the next pending task from the server.
   * Returns task object or null (empty queue / error).
   */
  async fetchTask() {
    try {
      const res = await fetch(`${this.baseUrl}/api/browser/tasks`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });

      if (res.status === 204 || res.status === 404) {
        // No tasks pending
        this._lastError = null;
        return null;
      }

      if (!res.ok) {
        this._lastError = `HTTP ${res.status}`;
        return null;
      }

      const data = await res.json();
      this._lastError = null;

      // Validate TTL before returning
      if (data && data.id) {
        if (this._isExpired(data)) {
          console.log(`[GlowForge] Task ${data.id} is expired — skipping`);
          await this.postResult(data.id, { status: 'expired', skipped: true });
          return null;
        }
        return data;
      }

      return null;
    } catch (err) {
      this._lastError = err.message;
      console.warn('[GlowForge] fetchTask error:', err.message);
      return null;
    }
  }

  /**
   * Post a task result back to the server.
   *
   * result shape: { status: 'success'|'error'|'expired', data?: any, error?: string }
   */
  async postResult(taskId, result) {
    try {
      const res = await fetch(`${this.baseUrl}/api/browser/results/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...result,
          completed_at: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.warn(`[GlowForge] postResult failed for ${taskId}: HTTP ${res.status}`);
        return false;
      }

      return true;
    } catch (err) {
      console.warn(`[GlowForge] postResult error for ${taskId}:`, err.message);
      return false;
    }
  }

  /**
   * Fetch queue status (pending count, recent results).
   */
  async fetchQueueStatus() {
    try {
      const res = await fetch(`${this.baseUrl}/api/browser/queue`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Check whether a task has exceeded its TTL.
   */
  _isExpired(task) {
    if (!task.created_at || !task.ttl_seconds) return false;
    const created = new Date(task.created_at).getTime();
    const now = Date.now();
    return (now - created) / 1000 > task.ttl_seconds;
  }

  get lastError() {
    return this._lastError;
  }
}
