/**
 * AgriTraceX — Global Socket.IO Client Manager
 * Include AFTER socket.io.js on every dashboard page.
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Connection status indicator (updates .socket-status elements)
 * - Page-specific channel subscription
 * - Exposes window.agriSocket for all dashboards
 */
(function () {
  'use strict';

  const SERVER_URL    = window.location.origin || 'http://localhost:3000';
  const RECONNECT_MAX = 10;

  // ── Connect ─────────────────────────────────────────────────────────────────
  const socket = io(SERVER_URL, {
    transports:          ['websocket', 'polling'],
    reconnection:        true,
    reconnectionAttempts: RECONNECT_MAX,
    reconnectionDelay:   1000,
    reconnectionDelayMax: 10000,
    timeout:             20000,
  });

  window.agriSocket = socket;

  // ── Status dot helper ───────────────────────────────────────────────────────
  function setStatus(state) {
    // state: 'online' | 'offline' | 'reconnecting'
    const colors = { online: '#1e6e45', offline: '#b91c1c', reconnecting: '#b45309' };
    const labels = { online: 'Live', offline: 'Offline', reconnecting: 'Reconnecting...' };
    document.querySelectorAll('.socket-status').forEach(el => {
      el.style.setProperty('--s-color', colors[state] || '#6b7280');
      el.textContent = labels[state] || state;
      el.dataset.state = state;
    });
  }

  // ── Connection events ───────────────────────────────────────────────────────
  socket.on('connect', () => {
    console.log('[Socket.IO] Connected:', socket.id);
    setStatus('online');

    // Subscribe to channels based on current page
    const page = document.body.dataset.page || '';
    if (page === 'drone')     socket.emit('drone:subscribe', 'all');
    if (page === 'dashboard') socket.emit('dashboard:subscribe');
  });

  socket.on('disconnect', reason => {
    console.warn('[Socket.IO] Disconnected:', reason);
    setStatus('offline');
  });

  socket.on('connect_error', err => {
    console.warn('[Socket.IO] Error:', err.message);
    setStatus('reconnecting');
  });

  socket.on('reconnect_attempt', n => {
    console.log(`[Socket.IO] Reconnect attempt ${n}/${RECONNECT_MAX}`);
    setStatus('reconnecting');
  });

  socket.on('reconnect', () => {
    console.log('[Socket.IO] Reconnected successfully');
    setStatus('online');
  });

  socket.on('reconnect_failed', () => {
    console.error('[Socket.IO] Reconnect failed after max attempts');
    setStatus('offline');
  });

  // ── Global event relay — pages can listen via: ────────────────────────────
  //    window.addEventListener('iot:reading', e => { e.detail = payload })
  const RELAY_EVENTS = [
    'iot:reading', 'telemetry:broadcast', 'image:uploaded',
    'alert:new', 'weather:update', 'drone:status',
  ];
  RELAY_EVENTS.forEach(evt => {
    socket.on(evt, data => {
      window.dispatchEvent(new CustomEvent(evt, { detail: data }));
    });
  });

  // ── Inject CSS for .socket-status dots ─────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .socket-status {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: .65rem; font-weight: 700; padding: 3px 8px;
      border-radius: 4px; color: var(--s-color, #6b7280);
      background: color-mix(in srgb, var(--s-color, #6b7280) 12%, white);
      border: 1px solid color-mix(in srgb, var(--s-color, #6b7280) 25%, white);
    }
    .socket-status::before {
      content: '';
      display: inline-block; width: 7px; height: 7px; border-radius: 50%;
      background: var(--s-color, #6b7280);
      animation: socketPulse 1.5s infinite;
    }
    .socket-status[data-state="offline"]::before,
    .socket-status[data-state="online"]::before  { animation: none; }
    @keyframes socketPulse { 0%,100%{opacity:1}50%{opacity:.4} }
  `;
  document.head.appendChild(style);

})();
