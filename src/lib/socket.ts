import { getStoredToken } from './api';

export type SocketEventHandler = (payload: any) => void;

class SocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<SocketEventHandler>> = new Map();
  private reconnectTimer: any = null;
  private isConnecting = false;

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = getStoredToken();
    if (!token) return;

    this.isConnecting = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        // Authenticate immediately
        this.send({ type: 'auth', token });
        this.emit('connection', { status: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(data.type, data);
        } catch (e) {
          console.error('[Socket] Parse error', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.emit('connection', { status: 'disconnected' });
        // Attempt reconnect if still have token
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          if (getStoredToken()) {
            this.connect();
          }
        }, 3000);
      };

      this.ws.onerror = (err) => {
        console.warn('[Socket] error', err);
        this.ws?.close();
      };
    } catch (err) {
      this.isConnecting = false;
      console.error('[Socket] Connect exception', err);
    }
  }

  public disconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[Socket] Attempted to send while socket is not open');
    }
  }

  public on(event: string, handler: SocketEventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public off(event: string, handler: SocketEventHandler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, payload: any) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((h) => h(payload));
    }
  }
}

export const socketClient = new SocketClient();
