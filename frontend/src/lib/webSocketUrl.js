import { axiosInstance } from '../api/axiosInstance';

function resolveBaseWebSocketUrl() {
  const configuredUrl = import.meta.env.VITE_WS_URL;

  if (typeof window === 'undefined') {
    return configuredUrl || 'ws://localhost:8080/ws';
  }

  if (!configuredUrl) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  if (configuredUrl.startsWith('ws://') || configuredUrl.startsWith('wss://')) {
    return configuredUrl;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const normalizedPath = configuredUrl.startsWith('/') ? configuredUrl : `/${configuredUrl}`;
  return `${protocol}//${window.location.host}${normalizedPath}`;
}

let cachedTicket = null;
let cachedTicketExpiresAt = 0;
let ticketRequestPromise = null;

async function issueWebSocketTicket() {
  const response = await axiosInstance.post('/auth/ws-ticket');
  const ticket = response.data?.data?.ticket ?? response.data?.ticket;

  if (!ticket) {
    throw new Error('WebSocket ticket was not returned.');
  }

  cachedTicket = ticket;
  cachedTicketExpiresAt = Date.now() + 45_000;
  return ticket;
}

async function getWebSocketTicket() {
  if (cachedTicket && cachedTicketExpiresAt > Date.now()) {
    return cachedTicket;
  }

  if (!ticketRequestPromise) {
    ticketRequestPromise = issueWebSocketTicket().finally(() => {
      ticketRequestPromise = null;
    });
  }

  return ticketRequestPromise;
}

export async function getAuthenticatedWebSocketUrl() {
  const baseUrl = resolveBaseWebSocketUrl();

  if (typeof window === 'undefined') {
    return baseUrl;
  }

  const ticket = await getWebSocketTicket();
  const url = new URL(baseUrl);
  url.searchParams.set('ticket', ticket);
  return url.toString();
}

export function clearCachedWebSocketTicket() {
  cachedTicket = null;
  cachedTicketExpiresAt = 0;
}
