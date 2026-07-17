if (typeof window !== "undefined") {
  if (!window.crypto) {
    (window as any).crypto = {} as any;
  }
  if (!window.crypto.randomUUID) {
    (window.crypto as any).randomUUID = function() {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
  }
}

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "./services/ws-client.js";

// Import all pages to register their custom elements
import "./components/control/overview-page.js";
import "./components/control/health-page.js";
import "./components/control/self-healing-page.js";
import "./components/control/channels-page.js";
import "./components/control/instances-page.js";
import "./components/control/sessions-page.js";
import "./components/control/cron-page.js";
import "./components/chat/chat-page.js";
import "./components/agents/skills-page.js";
import "./components/agents/nodes-page.js";
import "./components/agents/bus-monitor-page.js";
import "./components/agents/agents-manager.js";
import "./components/agents/teams-manager.js";
import "./components/agents/agent-files.js";
import "./components/agents/models-manager.js";
import "./components/agents/advanced-panel.js";
import "./components/agents/autonomy-page.js";
import "./components/settings/config-editor.js";
import "./components/settings/debug-page.js";
import "./components/settings/logs-page.js";
import "./components/resources/docs-page.js";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  tag: string;
}

@customElement("app-shell")
export class AppShell extends LitElement {
  @state() private activeRoute = "overview";
  @state() private activeRouteSecondary = "chat";
  @state() private splitView = false;
  @state() private wsStatus: "connected" | "disconnected" | "connecting" = "disconnected";
  @state() private activeTheme = "dark";
  @state() private sidebarCollapsed = false;
  @state() private mobileMenuOpen = false;
  
  // Command Palette
  @state() private paletteOpen = false;
  @state() private paletteSearch = "";
  @state() private selectedPaletteIndex = 0;

  // Split-pane dragging state
  private isDragging = false;
  @state() private leftPaneWidth = 50; // percentage

  private wsClient = WsClient.getInstance();

  private menuItems: MenuItem[] = [
    { id: "overview", name: "System Overview", category: "Control", icon: "📊", tag: "overview-page" },
    { id: "health", name: "System Health & Watchdog", category: "Control", icon: "🛡️", tag: "health-page" },
    { id: "self-healing", name: "Self-Healing Center", category: "Control", icon: "🩹", tag: "self-healing-page" },
    { id: "channels", name: "Channels Setup", category: "Control", icon: "🔌", tag: "channels-page" },
    { id: "instances", name: "Agent Instances", category: "Control", icon: "⚙️", tag: "instances-page" },
    { id: "sessions", name: "Sessions Logs", category: "Control", icon: "📁", tag: "sessions-page" },
    { id: "cron", name: "Scheduled Cron Jobs", category: "Control", icon: "⏱️", tag: "cron-page" },
    { id: "chat", name: "Direct Chat Console", category: "Chat", icon: "💬", tag: "chat-page" },
    { id: "agents-manager", name: "Agents Registry", category: "Agents", icon: "🤖", tag: "agents-manager" },
    { id: "teams-manager", name: "Teams Registry", category: "Agents", icon: "👥", tag: "teams-manager" },
    { id: "agent-files", name: "Agent Files Editor", category: "Agents", icon: "📝", tag: "agent-files" },
    { id: "models-manager", name: "Providers & Models", category: "Agents", icon: "🧠", tag: "models-manager" },
    { id: "advanced-panel", name: "Advanced AI Settings", category: "Agents", icon: "🧠", tag: "advanced-panel" },
    { id: "skills", name: "Skills Pack Manager", category: "Agents", icon: "🧰", tag: "skills-page" },
    { id: "autonomy", name: "Autonomy & Boundaries", category: "Agents", icon: "🧠", tag: "autonomy-page" },
    { id: "nodes", name: "Pipeline Nodes", category: "Agents", icon: "⛓️", tag: "nodes-page" },
    { id: "bus-monitor", name: "Event Bus Monitor", category: "Agents", icon: "📡", tag: "bus-monitor-page" },
    { id: "config", name: "Config Editor", category: "Settings", icon: "🛠️", tag: "config-editor" },
    { id: "debug", name: "Latencies Debug", category: "Settings", icon: "🐛", tag: "debug-page" },
    { id: "logs", name: "Live Terminal Logs", category: "Settings", icon: "📝", tag: "logs-page" },
    { id: "docs", name: "Documentation Site", category: "Resources", icon: "📖", tag: "docs-page" }
  ];

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      position: relative;
    }

    /* Background Glowing Blurs (Cyberpunk style) */
    .glow-blur {
      position: absolute;
      width: 30vw;
      height: 30vw;
      border-radius: 50%;
      filter: blur(150px);
      pointer-events: none;
      z-index: -1;
      opacity: 0.15;
    }

    .glow-left {
      top: 10%;
      left: 5%;
      background: var(--accent-primary);
    }

    .glow-right {
      bottom: 10%;
      right: 5%;
      background: var(--accent-secondary);
    }

    /* Core Shell Grid */
    .shell-container {
      display: flex;
      height: 100%;
      width: 100%;
      position: relative;
      background: transparent;
      z-index: 1;
    }

    /* Sidebar Styles */
    .sidebar {
      width: var(--sidebar-width);
      background-color: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      transition: width var(--transition-speed) ease;
      z-index: 10;
    }

    .sidebar.collapsed {
      width: 60px;
    }

    .sidebar-header {
      height: var(--header-height);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    .logo {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.15rem;
      letter-spacing: 1px;
      color: var(--accent-secondary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      white-space: nowrap;
      overflow: hidden;
    }

    .sidebar.collapsed .logo {
      display: none;
    }

    .logo-dot {
      width: 8px;
      height: 8px;
      background: var(--accent-primary);
      border-radius: 50%;
    }

    .sidebar-menu {
      flex: 1;
      overflow-y: auto;
      padding: 1rem 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .category-title {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--text-muted);
      padding-left: 0.75rem;
      margin-bottom: 0.25rem;
    }

    .sidebar.collapsed .category-title {
      display: none;
    }

    .nav-list {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 0.75rem;
      border-radius: var(--border-radius);
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-speed) ease;
    }

    .nav-item:hover {
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .nav-item.active {
      background-color: var(--accent-glow);
      color: var(--text-primary);
      border-left: 3px solid var(--accent-primary);
    }

    .nav-icon {
      font-size: 1.1rem;
    }

    .sidebar.collapsed .nav-item {
      justify-content: center;
      padding: 0.6rem 0;
    }

    .sidebar.collapsed .nav-text {
      display: none;
    }

    /* Main Area Header & Container */
    .main-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      background-color: var(--bg-primary);
      overflow: hidden;
      position: relative;
    }

    .header-bar {
      height: var(--header-height);
      background-color: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.5rem;
      z-index: 5;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .header-title {
      font-family: var(--font-display);
      font-weight: 600;
      font-size: 1.1rem;
      color: var(--text-primary);
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    /* Status badge styling */
    .health-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.25rem 0.6rem;
      border-radius: 20px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
    }

    .health-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }

    .health-dot.connected {
      background-color: var(--status-green);
      animation: pulseGlow 1.5s infinite;
    }

    .health-dot.connecting {
      background-color: var(--status-yellow);
    }

    .health-dot.disconnected {
      background-color: var(--status-red);
      animation: pulseRedGlow 1.5s infinite;
    }

    /* Split-Pane Content Container */
    .content-panes {
      flex: 1;
      display: flex;
      overflow: hidden;
      position: relative;
    }

    .pane {
      height: 100%;
      overflow-y: auto;
      position: relative;
    }

    .pane-content {
      padding: 1.5rem;
      min-height: 100%;
    }

    /* Drag Divider */
    .divider {
      width: 6px;
      background-color: var(--border-color);
      cursor: col-resize;
      transition: background-color 0.2s;
      position: relative;
      z-index: 10;
    }

    .divider:hover, .divider.active {
      background-color: var(--accent-primary);
    }

    /* Control Panel Toggles */
    .btn {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.2s;
    }

    .btn:hover {
      background-color: var(--border-color);
    }

    .btn.active {
      background-color: var(--accent-primary);
      border-color: var(--accent-primary);
    }

    .palette-hint {
      font-size: 0.75rem;
      color: var(--text-muted);
      border: 1px solid var(--border-color);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      background: var(--bg-primary);
    }

    /* Theme selector */
    .theme-select {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.4rem;
      border-radius: 6px;
      cursor: pointer;
    }

    /* Command Palette Overlay */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 100;
      display: flex;
      justify-content: center;
      padding-top: 10vh;
    }

    .palette-box {
      width: 550px;
      max-height: 400px;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .palette-search-input {
      width: 100%;
      background: var(--bg-primary);
      border: none;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 1rem;
      font-size: 1rem;
      font-family: var(--font-sans);
      outline: none;
    }

    .palette-results {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem;
    }

    .palette-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      border-radius: var(--border-radius);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s;
    }

    .palette-item:hover, .palette-item.selected {
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .palette-item-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .palette-category {
      font-size: 0.7rem;
      background: var(--bg-primary);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      color: var(--text-muted);
      border: 1px solid var(--border-color);
    }

    /* Mobile Hamburger drawer styles */
    .menu-toggle {
      display: none;
    }

    .sidebar-close {
      display: none;
    }

    @media (max-width: 768px) {
      .menu-toggle {
        display: block;
      }
      
      .sidebar {
        position: absolute;
        left: -100%;
        top: 0;
        bottom: 0;
        width: 260px;
        transition: left var(--transition-speed) ease;
      }

      .sidebar.mobile-open {
        left: 0;
      }

      .sidebar-close {
        display: block;
      }

      .divider {
        display: none;
      }

      .content-panes {
        flex-direction: column;
      }

      .pane {
        width: 100% !important;
        height: 50% !important;
      }

      .palette-box {
        width: 90vw;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.wsClient.addStatusListener(this.handleWsStatus.bind(this));
    window.addEventListener("keydown", this.handleKeydown.bind(this));
    window.addEventListener("mousemove", this.handleMousemove.bind(this));
    window.addEventListener("mouseup", this.handleMouseup.bind(this));
    
    // Default setup theme
    const storedTheme = localStorage.getItem("komorebi_theme") || "dark";
    this.setTheme(storedTheme);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.wsClient.removeStatusListener(this.handleWsStatus.bind(this));
    window.removeEventListener("keydown", this.handleKeydown.bind(this));
    window.removeEventListener("mousemove", this.handleMousemove.bind(this));
    window.removeEventListener("mouseup", this.handleMouseup.bind(this));
  }

  private handleWsStatus(status: "connected" | "disconnected" | "connecting") {
    this.wsStatus = status;
  }

  private setTheme(theme: string) {
    this.activeTheme = theme;
    localStorage.setItem("komorebi_theme", theme);
    document.documentElement.setAttribute("theme", theme);
  }

  private handleKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      this.paletteOpen = !this.paletteOpen;
      this.paletteSearch = "";
      this.selectedPaletteIndex = 0;
    } else if (e.key === "Escape") {
      this.paletteOpen = false;
    } else if (this.paletteOpen) {
      const results = this.getFilteredPaletteItems();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.selectedPaletteIndex = (this.selectedPaletteIndex + 1) % results.length;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.selectedPaletteIndex = (this.selectedPaletteIndex - 1 + results.length) % results.length;
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (results[this.selectedPaletteIndex]) {
          this.navigate(results[this.selectedPaletteIndex].id);
        }
      }
    }
  }

  private navigate(routeId: string, secondary = false) {
    if (secondary) {
      this.activeRouteSecondary = routeId;
    } else {
      this.activeRoute = routeId;
    }
    this.paletteOpen = false;
    this.mobileMenuOpen = false;
  }

  private getFilteredPaletteItems(): MenuItem[] {
    if (!this.paletteSearch) return this.menuItems;
    const query = this.paletteSearch.toLowerCase();
    return this.menuItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
    );
  }

  // --- Resizable split-pane mouse handlers ---
  private startDragging(e: MouseEvent) {
    e.preventDefault();
    this.isDragging = true;
    this.shadowRoot?.querySelector(".divider")?.classList.add("active");
  }

  private handleMousemove(e: MouseEvent) {
    if (!this.isDragging) return;
    const container = this.shadowRoot?.querySelector(".content-panes");
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const widthPercentage = ((e.clientX - rect.left) / rect.width) * 100;
    this.leftPaneWidth = Math.max(15, Math.min(85, widthPercentage));
  }

  private handleMouseup() {
    if (this.isDragging) {
      this.isDragging = false;
      this.shadowRoot?.querySelector(".divider")?.classList.remove("active");
    }
  }

  render() {
    const filteredItems = this.getFilteredPaletteItems();
    
    // Group menu items by category
    const categories = Array.from(new Set(this.menuItems.map(m => m.category)));

    return html`
      <div class="glow-blur glow-left"></div>
      <div class="glow-blur glow-right"></div>
      <div class="shell-container">
        <!-- Sidebar Drawer -->
        <aside class="sidebar ${this.sidebarCollapsed ? "collapsed" : ""} ${this.mobileMenuOpen ? "mobile-open" : ""}">
          <div class="sidebar-header">
            <div class="logo">
              <div class="logo-dot"></div>
              <span>KOMOREBI OMOI</span>
            </div>
            <button class="btn sidebar-close" @click=${() => this.mobileMenuOpen = false}>✕</button>
            <button class="btn" style="padding: 0.25rem 0.5rem" @click=${() => this.sidebarCollapsed = !this.sidebarCollapsed}>
              ${this.sidebarCollapsed ? "▶" : "◀"}
            </button>
          </div>
          
          <div class="sidebar-menu">
            ${categories.map(category => html`
              <div>
                <div class="category-title">${category}</div>
                <div class="nav-list">
                  ${this.menuItems.filter(m => m.category === category).map(item => html`
                    <div 
                      class="nav-item ${this.activeRoute === item.id ? "active" : ""}" 
                      @click=${() => this.navigate(item.id)}
                    >
                      <span class="nav-icon">${item.icon}</span>
                      <span class="nav-text">${item.name}</span>
                    </div>
                  `)}
                </div>
              </div>
            `)}
          </div>
        </aside>

        <!-- Main Display Container -->
        <div class="main-area">
          <header class="header-bar">
            <div class="header-left">
              <button class="btn menu-toggle" @click=${() => this.mobileMenuOpen = true}>☰</button>
              <div class="header-title">CONTROL INTERFACE</div>
            </div>
            
            <div class="header-right">
              <!-- Split Screen Toggle -->
              <button class="btn ${this.splitView ? "active" : ""}" @click=${() => this.splitView = !this.splitView}>
                🪟 Split Multitask
              </button>
              
              <!-- Command Palette trigger hint -->
              <div class="btn" @click=${() => this.paletteOpen = true}>
                🔍 <span class="palette-hint">Ctrl + K</span> Search
              </div>

              <!-- Theme Selector -->
              <select class="theme-select" .value=${this.activeTheme} @change=${(e: any) => this.setTheme(e.target.value)}>
                <option value="dark">🌙 Dark Slate</option>
                <option value="light">☀️ Clinic Light</option>
                <option value="komorebi">🌲 Forest Glow</option>
              </select>

              <!-- Health Check Badge -->
              <div class="health-badge" style="cursor: pointer" @click=${this.reenterToken} title="Click to change Access Token">
                <span class="health-dot ${this.wsStatus}"></span>
                <span>${this.wsStatus.toUpperCase()}</span>
              </div>
            </div>
          </header>

          <!-- Client-side Page Router Mounting -->
          <div class="content-panes">
            <!-- Left / Primary Pane -->
            <div class="pane" style="width: ${this.splitView ? this.leftPaneWidth + "%" : "100%"}">
              <div class="pane-content">
                ${this.renderPage(this.activeRoute)}
              </div>
            </div>

            <!-- Resize Divider -->
            ${this.splitView ? html`
              <div class="divider" @mousedown=${this.startDragging}></div>
              
              <!-- Right / Secondary Pane -->
              <div class="pane" style="width: ${(100 - this.leftPaneWidth) + "%"}">
                <div class="pane-content" style="border-left: 1px solid var(--border-color)">
                  <div style="margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between">
                    <span style="font-weight: 600; color: var(--accent-secondary)">Secondary multitask workspace</span>
                    <select class="theme-select" style="padding: 0.2rem" .value=${this.activeRouteSecondary} @change=${(e: any) => this.navigate(e.target.value, true)}>
                      ${this.menuItems.map(m => html`<option value=${m.id}>${m.name}</option>`)}
                    </select>
                  </div>
                  ${this.renderPage(this.activeRouteSecondary)}
                </div>
              </div>
            ` : ""}
          </div>
        </div>
      </div>

      <!-- Command Palette Overlay -->
      ${this.paletteOpen ? html`
        <div class="modal-overlay" @click=${() => this.paletteOpen = false}>
          <div class="palette-box" @click=${(e: Event) => e.stopPropagation()}>
            <input 
              type="text" 
              class="palette-search-input" 
              placeholder="Search actions, files, configurations..." 
              .value=${this.paletteSearch}
              @input=${(e: any) => { this.paletteSearch = e.target.value; this.selectedPaletteIndex = 0; }}
              autofocus
            />
            <div class="palette-results">
              ${filteredItems.length === 0 ? html`
                <div style="padding: 1rem; text-align: center; color: var(--text-muted)">
                  No results found matching search string
                </div>
              ` : filteredItems.map((item, idx) => html`
                <div 
                  class="palette-item ${this.selectedPaletteIndex === idx ? "selected" : ""}"
                  @click=${() => this.navigate(item.id)}
                  @mouseenter=${() => this.selectedPaletteIndex = idx}
                >
                  <div class="palette-item-left">
                    <span>${item.icon}</span>
                    <span>${item.name}</span>
                  </div>
                  <span class="palette-category">${item.category}</span>
                </div>
              `)}
            </div>
          </div>
        </div>
      ` : ""}
    `;
  }

  private reenterToken() {
    const newToken = window.prompt("Enter new Gateway Access Token:", this.wsClient.getToken());
    if (newToken !== null) {
      this.wsClient.setToken(newToken.trim());
      window.location.reload();
    }
  }

  private renderPage(route: string) {
    switch (route) {
      case "overview":
        return html`<overview-page></overview-page>`;
      case "health":
        return html`<health-page></health-page>`;
      case "self-healing":
        return html`<self-healing-page></self-healing-page>`;
      case "channels":
        return html`<channels-page></channels-page>`;
      case "instances":
        return html`<instances-page></instances-page>`;
      case "sessions":
        return html`<sessions-page></sessions-page>`;
      case "cron":
        return html`<cron-page></cron-page>`;
      case "chat":
        return html`<chat-page></chat-page>`;
      case "agents-manager":
        return html`<agents-manager></agents-manager>`;
      case "teams-manager":
        return html`<teams-manager></teams-manager>`;
      case "agent-files":
        return html`<agent-files></agent-files>`;
      case "models-manager":
        return html`<models-manager></models-manager>`;
      case "advanced-panel":
        return html`<advanced-panel></advanced-panel>`;
      case "skills":
        return html`<skills-page></skills-page>`;
      case "autonomy":
        return html`<autonomy-page></autonomy-page>`;
      case "nodes":
        return html`<nodes-page></nodes-page>`;
      case "bus-monitor":
        return html`<bus-monitor-page></bus-monitor-page>`;
      case "config":
        return html`<config-editor></config-editor>`;
      case "debug":
        return html`<debug-page></debug-page>`;
      case "logs":
        return html`<logs-page></logs-page>`;
      case "docs":
        return html`<docs-page></docs-page>`;
      default:
        return html`<overview-page></overview-page>`;
    }
  }
}
