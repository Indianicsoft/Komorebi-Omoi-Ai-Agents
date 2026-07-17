import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

interface KnownFix {
  symptomFingerprint: string;
  rootCause: string;
  fixApplied: string;
  fixType: string;
  successRate: number;
  lastSeen: number;
  timesApplied: number;
  timesSucceeded: number;
}

interface Incident {
  id: string;
  timestamp: number;
  componentId: string;
  errorSignature: string;
  fingerprint: string;
  tier: number;
  status: "active" | "resolved" | "failed" | "pending_approval";
  diagnosis?: string;
  proposedFix?: any;
  outcome?: string;
}

@customElement("self-healing-page")
export class SelfHealingPage extends LitElement {
  @state() private knownFixes: KnownFix[] = [];
  @state() private incidents: Incident[] = [];
  @state() private pendingFixes: any[] = [];
  @state() private loading = true;
  @state() private actionLoading = new Set<string>();

  private wsClient = WsClient.getInstance();
  private pollInterval: any = null;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      font-family: var(--font-display, "Inter", sans-serif);
      color: var(--text-primary);
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .title {
      font-size: 1.75rem;
      font-weight: 800;
      background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .section-title {
      font-size: 1.2rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.5rem;
    }

    @media (max-width: 1024px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background: rgba(30, 30, 40, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 1.5rem;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    .status-badge {
      font-size: 0.7rem;
      font-weight: bold;
      text-transform: uppercase;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      letter-spacing: 0.5px;
      display: inline-block;
    }

    .status-active {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .status-resolved {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .status-failed {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .status-pending {
      background: rgba(59, 130, 246, 0.15);
      color: #3b82f6;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .timeline {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .timeline-item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 12px;
      padding: 1rem;
    }

    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .comp-name {
      font-weight: 700;
      color: #fff;
      font-size: 0.95rem;
    }

    .error-sig {
      font-family: monospace;
      font-size: 0.8rem;
      background: rgba(0, 0, 0, 0.2);
      padding: 0.1rem 0.3rem;
      border-radius: 4px;
      color: #e2e8f0;
      word-break: break-all;
    }

    .time-stamp {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .outcome-box {
      font-size: 0.85rem;
      background: rgba(255, 255, 255, 0.03);
      padding: 0.5rem;
      border-radius: 6px;
      color: #e2e8f0;
      border-left: 3px solid var(--accent-primary);
    }

    .approval-card {
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 16px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      box-shadow: 0 4px 20px rgba(59, 130, 246, 0.1);
    }

    .approval-btn-group {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .btn {
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .btn-approve {
      background: #10b981;
      color: #white;
    }

    .btn-approve:hover {
      background: #059669;
    }

    .btn-rollback {
      background: #ef4444;
      color: white;
    }

    .btn-rollback:hover {
      background: #dc2626;
    }

    .btn-loading {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .known-fixes-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .fix-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.04);
    }

    .fix-info {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .fix-cause {
      font-size: 0.85rem;
      font-weight: 600;
      color: #fff;
    }

    .fix-details {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .success-rate-pct {
      font-weight: 700;
      color: #10b981;
      font-size: 1rem;
    }

    .empty-state {
      padding: 2rem;
      text-align: center;
      color: var(--text-muted);
      font-style: italic;
      font-size: 0.9rem;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.fetchStatus();
    this.pollInterval = setInterval(() => this.fetchStatus(), 3000);

    // Subscribe to bus updates for real-time status shifts
    this.wsClient.addEventListener(this.handleBusMessage);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.wsClient.removeEventListener(this.handleBusMessage);
  }

  private handleBusMessage = (event: string, data: any) => {
    if (event === "busMessage" && data.topic === "self_healing_incident") {
      this.fetchStatus();
    }
  };

  private async fetchStatus() {
    try {
      const data = await this.wsClient.send<any>("getSelfHealingStatus");
      this.knownFixes = data.knownFixes || [];
      this.incidents = data.incidents || [];
      this.pendingFixes = data.pendingFixes || [];
      this.loading = false;
    } catch (err) {
      console.error("[SelfHealingPage] Failed to fetch status:", err);
    }
  }

  private async approveFix(fingerprint: string, fix: any) {
    if (this.actionLoading.has(fingerprint)) return;
    this.actionLoading.add(fingerprint);
    this.requestUpdate();
    try {
      const res = await this.wsClient.send<any>("applySelfHealingFix", { fingerprint, fix });
      if (res.success) {
        alert("Fix applied and verified successfully!");
      } else {
        alert("Verification failed: regression tests failed, fix rolled back.");
      }
    } catch (err: any) {
      alert(`Error applying fix: ${err.message}`);
    } finally {
      this.actionLoading.delete(fingerprint);
      this.fetchStatus();
    }
  }

  private async rollbackFix(fingerprint: string) {
    if (this.actionLoading.has(fingerprint)) return;
    this.actionLoading.add(fingerprint);
    this.requestUpdate();
    try {
      const res = await this.wsClient.send<any>("rollbackSelfHealingFix", { fingerprint });
      if (res.success) {
        alert("Successfully rolled back code changes.");
      } else {
        alert("Failed to rollback fix.");
      }
    } catch (err: any) {
      alert(`Error during rollback: ${err.message}`);
    } finally {
      this.actionLoading.delete(fingerprint);
      this.fetchStatus();
    }
  }

  render() {
    if (this.loading) {
      return html`<div class="empty-state">Loading self-healing center...</div>`;
    }

    return html`
      <div class="title-row">
        <h1 class="title">Self-Healing Center</h1>
      </div>

      ${this.pendingFixes.length > 0
        ? html`
            <div class="timeline">
              <h2 class="section-title">🚨 Pending Approvals (${this.pendingFixes.length})</h2>
              ${this.pendingFixes.map(
                (p) => html`
                  <div class="approval-card">
                    <div class="timeline-header">
                      <div>
                        <span class="comp-name">${p.componentId}</span>
                        <div class="error-sig">${p.errorSignature}</div>
                      </div>
                      <span class="status-badge status-pending">Escalated</span>
                    </div>
                    <div class="outcome-box">
                      <strong>Root Cause:</strong> ${p.diagnosis?.rootCause || p.reason}<br />
                      <strong>Proposed Fix:</strong> ${p.diagnosis?.fixApplied || "None"}
                    </div>
                    <div class="approval-btn-group">
                      <button
                        class="btn btn-approve ${this.actionLoading.has(p.fingerprint) ? "btn-loading" : ""}"
                        @click=${() => this.approveFix(p.fingerprint, p.diagnosis)}
                      >
                        Approve & Apply
                      </button>
                      <button
                        class="btn btn-rollback ${this.actionLoading.has(p.fingerprint) ? "btn-loading" : ""}"
                        @click=${() => this.rollbackFix(p.fingerprint)}
                      >
                        Rollback
                      </button>
                    </div>
                  </div>
                `
              )}
            </div>
          `
        : ""}

      <div class="grid">
        <div class="card">
          <h2 class="section-title">🛡️ Incident log timeline</h2>
          <div class="timeline">
            ${this.incidents.length === 0
              ? html`<div class="empty-state">No failures or recovery runs logged yet.</div>`
              : this.incidents.slice().reverse().map((i) => {
                  let badgeClass = "status-active";
                  if (i.status === "resolved") badgeClass = "status-resolved";
                  if (i.status === "failed") badgeClass = "status-failed";
                  if (i.status === "pending_approval") badgeClass = "status-pending";

                  return html`
                    <div class="timeline-item">
                      <div class="timeline-header">
                        <div>
                          <span class="comp-name">${i.componentId} (Tier ${i.tier})</span>
                          <div class="error-sig">${i.errorSignature}</div>
                        </div>
                        <span class="status-badge ${badgeClass}">${i.status}</span>
                      </div>
                      ${i.diagnosis ? html`<div class="outcome-box"><strong>Diagnosis:</strong> ${i.diagnosis}</div>` : ""}
                      ${i.outcome ? html`<div class="outcome-box" style="border-left-color: #10b981;"><strong>Outcome:</strong> ${i.outcome}</div>` : ""}
                      <div class="time-stamp">
                        ${new Date(i.timestamp).toLocaleString()} | fingerprint: ${i.fingerprint.substring(0, 8)}
                        ${i.proposedFix && i.proposedFix.fixType === "code"
                          ? html` | <a href="#" style="color: #ef4444; font-weight: bold; text-decoration: none;" @click=${(e: Event) => { e.preventDefault(); this.rollbackFix(i.fingerprint); }}>Rollback Code</a>`
                          : ""}
                      </div>
                    </div>
                  `;
                })}
          </div>
        </div>

        <div class="card">
          <h2 class="section-title">🧠 Immune Memory registry</h2>
          <div class="known-fixes-list">
            ${this.knownFixes.length === 0
              ? html`<div class="empty-state">No vaccination records or immune fixes saved yet.</div>`
              : this.knownFixes.map(
                  (k) => html`
                    <div class="fix-item">
                      <div class="fix-info">
                        <span class="fix-cause">${k.rootCause}</span>
                        <span class="fix-details">
                          Type: ${k.fixType.toUpperCase()} | Runs: ${k.timesApplied}
                        </span>
                      </div>
                      <span class="success-rate-pct">${(k.successRate * 100).toFixed(0)}%</span>
                    </div>
                  `
                )}
          </div>
        </div>
      </div>
    `;
  }
}
