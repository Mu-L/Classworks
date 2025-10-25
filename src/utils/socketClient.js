// Lightweight reusable Socket.IO client singleton
// - Uses server domain from settings when available
// - Exposes join/leave helpers and event on/off wrappers

import { io } from 'socket.io-client';
import { getSetting } from '@/utils/settings';

let socket = null;
let connectedDomain = null;
const listeners = new Set();

export function getServerUrl() {
  // Prefer configured server domain; fallback to env; then current origin
  const cfg = getSetting('server.domain');
  const envUrl = import.meta?.env?.VITE_SERVER_URL;
  return cfg || envUrl || window.location.origin;
}

export function getSocket() {
  const serverUrl = getServerUrl();
  if (!socket || connectedDomain !== serverUrl) {
    if (socket) {
      try { socket.disconnect(); } catch (e) {
        void e; // ignore
      }
      socket = null;
    }
    connectedDomain = serverUrl;
    socket = io(serverUrl, { transports: ['websocket'] });

    // Re-attach previously registered event handlers on new socket instance
    listeners.forEach(({ event, handler }) => {
      socket.on(event, handler);
    });
  }
  return socket;
}

export function on(event, handler) {
  const s = getSocket();
  s.on(event, handler);
  listeners.add({ event, handler });
  return () => off(event, handler);
}

export function off(event, handler) {
  if (!socket) return;
  socket.off(event, handler);
  // Remove only matching entry
  for (const item of Array.from(listeners)) {
    if (item.event === event && item.handler === handler) {
      listeners.delete(item);
    }
  }
}

export function joinToken(token) {
  const s = getSocket();
  if (!token) return;
  s.emit('join-token', { token });
}

export function leaveToken(token) {
  if (!socket) return;
  socket.emit('leave-token', { token });
}

export function leaveAll() {
  if (!socket) return;
  socket.emit('leave-all');
}

export function onConnect(handler) {
  const s = getSocket();
  s.on('connect', handler);
  return () => s.off('connect', handler);
}

export function disconnect() {
  if (!socket) return;
  try { socket.disconnect(); } catch (e) {
    void e; // ignore
  }
  socket = null;
  connectedDomain = null;
  listeners.clear();
}
