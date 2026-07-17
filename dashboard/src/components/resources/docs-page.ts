import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { WsClient } from "../../services/ws-client.js";

@customElement("docs-page")
export class DocsPage extends LitElement {
  @state() private selectedDoc = "README.md";
  @state() private docContent = "Loading documentation...";
  @state() private docFiles = ["README.md", "ARCHITECTURE.md", "SECURITY.md", "AGENTS.md", "CLAWHUB-SECURITY.md"];

  private wsClient = WsClient.getInstance();

  static styles = css`
    :host {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 1.5rem;
      height: calc(100vh - 120px);
      font-family: var(--font-display, "Inter", sans-serif);
      color: var(--text-primary);
    }

    .sidebar {
      background: rgba(30, 30, 40, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      backdrop-filter: blur(12px);
    }

    .sidebar-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #9ca3af;
      margin-bottom: 0.5rem;
      font-weight: 700;
      padding-left: 0.5rem;
    }

    .doc-item {
      padding: 0.6rem 0.8rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      color: #9ca3af;
      transition: all 0.2s;
    }

    .doc-item:hover, .doc-item.active {
      color: #fff;
      background: rgba(255, 255, 255, 0.05);
    }

    .doc-item.active {
      background: rgba(167, 139, 250, 0.15);
      color: #a78bfa;
      border-left: 3px solid #a78bfa;
    }

    .content-panel {
      background: rgba(30, 30, 40, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 2rem;
      overflow-y: auto;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      line-height: 1.6;
    }

    /* Markdown Styles */
    .doc-h1 {
      font-size: 1.8rem;
      font-weight: 800;
      margin-bottom: 1rem;
      color: #fff;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 0.5rem;
    }

    .doc-h2 {
      font-size: 1.4rem;
      font-weight: 700;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      color: #f3f4f6;
    }

    .doc-h3 {
      font-size: 1.1rem;
      font-weight: 600;
      margin-top: 1rem;
      color: #e5e7eb;
    }

    p {
      margin-bottom: 1rem;
      color: #9ca3af;
      font-size: 0.95rem;
    }

    ul, ol {
      margin-left: 1.5rem;
      margin-bottom: 1rem;
      color: #9ca3af;
      font-size: 0.95rem;
    }

    li {
      margin-bottom: 0.4rem;
    }

    code {
      font-family: monospace;
      background: rgba(0, 0, 0, 0.3);
      padding: 0.15rem 0.3rem;
      border-radius: 4px;
      color: #ec4899;
      font-size: 0.85rem;
    }

    pre {
      background: #09090d;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 1rem;
      overflow-x: auto;
      margin-bottom: 1rem;
    }

    pre code {
      background: none;
      padding: 0;
      color: #34d399;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadDocContent();
  }

  private async loadDocContent() {
    this.docContent = "Loading content...";
    const token = this.wsClient.getToken();
    try {
      const res = await fetch(`${this.wsClient.getGatewayUrl()}/api/docs/${this.selectedDoc}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const body = await res.json();
        this.docContent = body.content || "Empty file.";
      } else {
        this.docContent = `Failed to retrieve documentation: ${res.statusText}`;
      }
    } catch {
      this.docContent = "Failed to communicate with gateway API.";
    }
  }

  private selectDoc(doc: string) {
    this.selectedDoc = doc;
    this.loadDocContent();
  }

  private parseMarkdown(md: string): string {
    if (!md) return "";
    
    // Resilient HTML escape
    let htmlContent = md
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Code blocks
    htmlContent = htmlContent.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);

    // Headers
    htmlContent = htmlContent.replace(/^#\s+(.+)$/gm, '<h1 class="doc-h1">$1</h1>');
    htmlContent = htmlContent.replace(/^##\s+(.+)$/gm, '<h2 class="doc-h2">$1</h2>');
    htmlContent = htmlContent.replace(/^###\s+(.+)$/gm, '<h3 class="doc-h3">$1</h3>');

    // Bold / inline code / lists
    htmlContent = htmlContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    htmlContent = htmlContent.replace(/`([^`]+)`/g, '<code>$1</code>');
    htmlContent = htmlContent.replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>');
    htmlContent = htmlContent.replace(/^\s*\*\s+(.+)$/gm, '<li>$1</li>');

    // Carriage returns to linebreaks
    htmlContent = htmlContent.replace(/\n\n/g, '<br/>');

    return htmlContent;
  }

  render() {
    return html`
      <div class="sidebar">
        <div class="sidebar-title">Documents</div>
        ${this.docFiles.map(doc => html`
          <div class="doc-item ${this.selectedDoc === doc ? "active" : ""}" @click=${() => this.selectDoc(doc)}>
            📄 ${doc.replace(".md", "")}
          </div>
        `)}
      </div>

      <div class="content-panel">
        ${unsafeHTML(this.parseMarkdown(this.docContent))}
      </div>
    `;
  }
}
