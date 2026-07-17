export interface RpcResponse<T = any> {
  type: "res";
  id: string;
  ok: boolean;
  payload?: T;
  error?: string;
}

export type WsStatusListener = (status: "connected" | "disconnected" | "connecting") => void;
export type WsEventListener = (event: string, data: any) => void;

export class WsClient {
  private static instance: WsClient | null = null;
  private socket: WebSocket | null = null;
  private token: string = "";
  private gatewayHost: string = "";
  private gatewayPort: number = 8000;
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private statusListeners = new Set<WsStatusListener>();
  private eventListeners = new Set<WsEventListener>();
  private reconnectTimeout: any = null;
  private reconnectAttempts = 0;
  private isConnecting = false;

  private constructor() {
    this.extractToken();
    this.connect();
  }

  public static getInstance(): WsClient {
    if (!WsClient.instance) {
      WsClient.instance = new WsClient();
    }
    return WsClient.instance;
  }

  private extractToken() {
    // 1. Try URL hash fragment first: #token=...
    const hash = window.location.hash;
    if (hash.startsWith("#token=")) {
      this.token = hash.replace("#token=", "").trim();
      sessionStorage.setItem("komorebi_gateway_token", this.token);
      // Strip token from URL bar for security
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
      return;
    }

    // 2. Try sessionStorage, fallback to prompt popup
    let storedToken = sessionStorage.getItem("komorebi_gateway_token");
    if (!storedToken) {
      storedToken = window.prompt("Komorebi Gateway Access Token required:");
      if (storedToken) {
        storedToken = storedToken.trim();
        sessionStorage.setItem("komorebi_gateway_token", storedToken);
      }
    }
    this.token = storedToken || "";

    // 3. Fallback to shared token from config if still empty
  }

  public getToken(): string {
    return this.token;
  }

  public getGatewayUrl(): string {
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    return `${protocol}//${this.gatewayHost}:${this.gatewayPort}`;
  }

  public setToken(newToken: string) {
    this.token = newToken;
    sessionStorage.setItem("komorebi_gateway_token", newToken);
    this.reconnectAttempts = 0;
    this.connect();
  }

  public async connect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Load gateway configuration to obtain auth token and host/port
    let config: any = {};
    try {
      const configResponse = await fetch('/komorebi.config.json');
      if (configResponse.ok) {
        const text = await configResponse.text();
        if (text && text.trim().startsWith("{")) {
          config = JSON.parse(text);
        }
      }
    } catch (e) {
      console.warn("[WsClient] Failed to load /komorebi.config.json, using local hostname fallback.");
    }

    this.token = config.gateway?.authToken || this.token;
    
    // Use window.location.hostname/port dynamically to prevent CORS preflight blocks.
    // Fall back to config values only when hosted on a different development server (e.g. Vite on port 5173/3000).
    const isDevServer = window.location.port === "5173" || window.location.port === "3000";
    this.gatewayHost = isDevServer ? (config.gateway?.host || "127.0.0.1") : window.location.hostname;
    this.gatewayPort = isDevServer ? (config.gateway?.port || 2389) : parseInt(window.location.port || "8000", 10);

    // Convert getGatewayUrl() http(s) to ws(s) protocol and append gateway token parameter
    const wsUrl = this.getGatewayUrl().replace(/^http/, "ws") + `?token=${encodeURIComponent(this.token)}`;

    console.log(`[WsClient] Connecting to: ${wsUrl.replace(this.token, "[REDACTED]")}`);
    
    try {
      this.socket = new WebSocket(wsUrl);
      this.setupSocketHandlers();
    } catch (err) {
      console.error("[WsClient] Connection error:", err);
      this.handleDisconnect();
    }
  }

  private setupSocketHandlers() {
    if (!this.socket) return;

    this.socket.onopen = () => {
      console.log("[WsClient] Connected to Gateway.");
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.notifyStatus("connected");

      // Auto-subscribe to the global event bus
      this.send("busSubscribe", { topic: "*" }).catch(() => {});
    };

    this.socket.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);
        if (frame.type === "res") {
          const handler = this.pendingRequests.get(frame.id);
          if (handler) {
            this.pendingRequests.delete(frame.id);
            if (frame.ok) {
              handler.resolve(frame.payload);
            } else {
              handler.reject(new Error(frame.error || "RPC Error"));
            }
          }
        } else if (frame.type === "evt") {
          this.notifyEvent(frame.event, frame.data);
        }
      } catch (err) {
        console.error("[WsClient] Message parsing failed:", err);
      }
    };

    this.socket.onclose = () => {
      console.warn("[WsClient] Connection closed.");
      this.handleDisconnect();
    };

    this.socket.onerror = (err) => {
      console.error("[WsClient] Socket error occurred:", err);
    };
  }

  private handleDisconnect() {
    this.socket = null;
    this.isConnecting = false;
    this.notifyStatus("disconnected");

    // Reject all pending requests
    for (const [id, handler] of this.pendingRequests.entries()) {
      handler.reject(new Error("WebSocket disconnected"));
      this.pendingRequests.delete(id);
    }

    // Exponential backoff reconnect
    this.reconnectAttempts++;
    const backoffMs = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    console.log(`[WsClient] Reconnecting in ${Math.round(backoffMs)}ms (Attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, backoffMs);
  }

  public send<T = any>(method: string, params: any = {}): Promise<T> {
    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return reject(new Error("WebSocket is not connected"));
      }

      this.pendingRequests.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }

  // --- Listeners registration ---
  public addStatusListener(listener: WsStatusListener) {
    this.statusListeners.add(listener);
    // Emit current state immediately
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      listener("connected");
    } else if (this.isConnecting) {
      listener("connecting");
    } else {
      listener("disconnected");
    }
  }

  public removeStatusListener(listener: WsStatusListener) {
    this.statusListeners.delete(listener);
  }

  public addEventListener(listener: WsEventListener) {
    this.eventListeners.add(listener);
  }

  public removeEventListener(listener: WsEventListener) {
    this.eventListeners.delete(listener);
  }

  private notifyStatus(status: "connected" | "disconnected" | "connecting") {
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (err) {
        console.error(err);
      }
    }
  }

  private notifyEvent(event: string, data: any) {
    for (const listener of this.eventListeners) {
      try {
        listener(event, data);
      } catch (err) {
        console.error(err);
      }
    }
  }
}
