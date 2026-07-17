import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { WsClient } from "../../services/ws-client.js";

interface Agent {
  id: string;
  name: string;
}

@customElement("agent-files")
export class AgentFiles extends LitElement {
  @state() private config: any = null;
  @state() private agents: Agent[] = [];
  @state() private selectedAgentId = "";
  @state() private files: string[] = [];
  @state() private selectedFilename = "";
  @state() private fileContent = "";
  @state() private isSaving = false;
  @state() private isModified = false;
  @state() private activeTab: "edit" | "preview" | "split" = "split";

  private wsClient = WsClient.getInstance();

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 120px);
      gap: 1rem;
    }

    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 0.75rem 1.25rem;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    .selector-group {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    select {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.45rem 0.75rem;
      outline: none;
      font-size: 0.9rem;
      font-family: var(--font-sans);
    }

    .btn {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.45rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.85rem;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .btn:hover {
      background-color: var(--border-color);
    }

    .btn-primary {
      background-color: var(--accent-primary);
      border-color: var(--accent-primary);
    }

    .btn-primary:hover {
      opacity: 0.9;
    }

    .status-badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background-color: rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
    }

    .status-badge.modified {
      background-color: var(--status-yellow-glow);
      color: var(--status-yellow);
    }

    .status-badge.saving {
      background-color: var(--accent-glow);
      color: var(--accent-secondary);
    }

    /* Workspace layout */
    .workspace {
      display: grid;
      grid-template-columns: 240px 1fr;
      gap: 1rem;
      flex: 1;
      min-height: 0;
    }

    .sidebar {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      overflow-y: auto;
    }

    .sidebar-title {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--accent-secondary);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.25rem;
    }

    .file-list {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .file-item {
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      color: var(--text-secondary);
      font-family: var(--font-mono);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .file-item:hover {
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .file-item.active {
      background-color: var(--accent-glow);
      color: var(--accent-secondary);
      border-left: 3px solid var(--accent-secondary);
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }

    .editor-container {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }

    .tab-bar {
      display: flex;
      background-color: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
      padding: 0.25rem 0.5rem 0 0.5rem;
      gap: 0.25rem;
    }

    .tab-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      padding: 0.45rem 1rem;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      border-top-left-radius: 6px;
      border-top-right-radius: 6px;
      transition: all 0.2s;
    }

    .tab-btn:hover {
      color: var(--text-primary);
      background-color: rgba(255,255,255,0.02);
    }

    .tab-btn.active {
      color: var(--accent-secondary);
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-bottom-color: var(--bg-secondary);
      font-weight: 600;
    }

    .editor-workspace {
      flex: 1;
      display: grid;
      min-height: 0;
    }

    .editor-workspace.split {
      grid-template-columns: 1fr 1fr;
    }

    .editor-pane {
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--border-color);
      height: 100%;
      min-height: 0;
    }

    textarea {
      flex: 1;
      background-color: var(--bg-primary);
      border: none;
      color: var(--text-primary);
      padding: 1rem;
      font-family: var(--font-mono);
      font-size: 0.9rem;
      line-height: 1.5;
      resize: none;
      outline: none;
      height: 100%;
      overflow-y: auto;
    }

    .preview-pane {
      background-color: var(--bg-secondary);
      padding: 1.5rem;
      overflow-y: auto;
      height: 100%;
      color: var(--text-primary);
      line-height: 1.6;
      font-family: var(--font-sans);
    }

    /* Markdown Rendering Styling */
    .preview-pane h1 {
      font-size: 1.75rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.3rem;
      margin-top: 0;
      margin-bottom: 1rem;
    }
    
    .preview-pane h2 {
      font-size: 1.35rem;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      padding-bottom: 0.25rem;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
    }

    .preview-pane h3 {
      font-size: 1.1rem;
      margin-top: 1.25rem;
      margin-bottom: 0.5rem;
    }

    .preview-pane p {
      margin-bottom: 1rem;
    }

    .preview-pane code {
      font-family: var(--font-mono);
      background-color: var(--bg-primary);
      padding: 0.15rem 0.35rem;
      border-radius: 4px;
      font-size: 0.85rem;
      color: var(--accent-secondary);
    }

    .preview-pane pre {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      margin-bottom: 1rem;
    }

    .preview-pane pre code {
      background: none;
      padding: 0;
      color: var(--text-primary);
    }

    .preview-pane ul, .preview-pane ol {
      margin-bottom: 1rem;
      padding-left: 1.5rem;
    }

    .preview-pane blockquote {
      border-left: 4px solid var(--accent-primary);
      background-color: rgba(0, 240, 255, 0.03);
      padding: 0.5rem 1rem;
      margin: 0 0 1rem 0;
      border-radius: 0 4px 4px 0;
    }

    .preview-pane blockquote.alert-note {
      border-left-color: var(--accent-secondary);
      background-color: rgba(123, 97, 255, 0.04);
    }

    .preview-pane blockquote.alert-warning {
      border-left-color: var(--status-yellow);
      background-color: rgba(255, 170, 0, 0.04);
    }

    .preview-pane blockquote.alert-danger {
      border-left-color: var(--status-red);
      background-color: rgba(255, 51, 102, 0.04);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadConfig();
  }

  private async loadConfig() {
    try {
      const data = await this.wsClient.send<any>("getSystemConfig");
      this.config = data.config;
      this.agents = this.config.agents || [];
      if (this.agents.length > 0 && !this.selectedAgentId) {
        this.selectedAgentId = this.agents[0].id;
        this.loadFilesList();
      }
    } catch (err) {
      console.error("[AgentFiles] Failed to load configuration:", err);
    }
  }

  private async loadFilesList() {
    if (!this.selectedAgentId) return;
    try {
      const data = await this.wsClient.send<any>("listAgentFiles", { agentId: this.selectedAgentId });
      this.files = data.files || [];
      if (this.files.length > 0) {
        const defaultFile = this.files.find(f => f.toUpperCase().includes("SOUL")) || this.files[0];
        this.loadFile(defaultFile);
      } else {
        this.selectedFilename = "";
        this.fileContent = "";
        this.isModified = false;
      }
    } catch (err) {
      console.error("[AgentFiles] Failed to load files list:", err);
      this.files = [];
      this.selectedFilename = "";
      this.fileContent = "";
      this.isModified = false;
    }
  }

  private async loadFile(filename: string) {
    if (!this.selectedAgentId || !filename) return;
    if (this.isModified && !confirm("You have unsaved changes. Discard them?")) return;

    try {
      const data = await this.wsClient.send<any>("readAgentFile", {
        agentId: this.selectedAgentId,
        filename
      });
      this.selectedFilename = filename;
      this.fileContent = data.content;
      this.isModified = false;
    } catch (err) {
      console.error("[AgentFiles] Failed to load file content:", err);
    }
  }

  private handleEditorInput(e: any) {
    this.fileContent = e.target.value;
    this.isModified = true;
  }

  private async saveFile() {
    if (!this.selectedAgentId || !this.selectedFilename) return;
    this.isSaving = true;

    try {
      await this.wsClient.send("writeAgentFile", {
        agentId: this.selectedAgentId,
        filename: this.selectedFilename,
        content: this.fileContent
      });

      this.isModified = false;
      alert(`File ${this.selectedFilename} saved successfully!`);
      await this.loadFilesList();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      this.isSaving = false;
    }
  }

  private createNewFile() {
    const filename = window.prompt("Enter new file path (e.g. soul.md or proactivity/memory.md):");
    if (!filename) return;

    let cleanName = filename.trim().replace(/\\/g, "/");
    if (!cleanName.endsWith(".md")) {
      cleanName += ".md";
    }

    if (this.files.includes(cleanName)) {
      alert("File already exists in workspace.");
      return;
    }

    this.selectedFilename = cleanName;
    this.fileContent = `# ${cleanName.split("/").pop()?.replace(".md", "")}\n\n`;
    this.isModified = true;
    this.activeTab = "edit";
  }

  private handleAgentChange(e: any) {
    if (this.isModified && !confirm("You have unsaved changes. Discard them?")) {
      e.target.value = this.selectedAgentId;
      return;
    }
    this.selectedAgentId = e.target.value;
    this.loadFilesList();
  }

  // Simple and clean custom Markdown compiler
  private parseMarkdown(md: string) {
    if (!md) return "";
    let htmlContent = md
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Code Blocks ``` ... ```
    htmlContent = htmlContent.replace(/```([\s\S]*?)```/gm, (_, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Inline code `code`
    htmlContent = htmlContent.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Headers
    htmlContent = htmlContent.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    htmlContent = htmlContent.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    htmlContent = htmlContent.replace(/^# (.*$)/gim, "<h1>$1</h1>");

    // GitHub Alerts blockquotes
    // > [!NOTE] / > [!IMPORTANT]
    htmlContent = htmlContent.replace(/^&gt;\s*\[!NOTE\]\s*([\s\S]*?)(?=\n\n|\n^[^&gt;]|$)/gim, (_, text) => {
      return `<blockquote class="alert-note"><strong>NOTE:</strong><br>${text.replace(/^&gt;\s?/gm, "").trim()}</blockquote>`;
    });
    htmlContent = htmlContent.replace(/^&gt;\s*\[!IMPORTANT\]\s*([\s\S]*?)(?=\n\n|\n^[^&gt;]|$)/gim, (_, text) => {
      return `<blockquote class="alert-note"><strong>IMPORTANT:</strong><br>${text.replace(/^&gt;\s?/gm, "").trim()}</blockquote>`;
    });
    htmlContent = htmlContent.replace(/^&gt;\s*\[!WARNING\]\s*([\s\S]*?)(?=\n\n|\n^[^&gt;]|$)/gim, (_, text) => {
      return `<blockquote class="alert-warning"><strong>WARNING:</strong><br>${text.replace(/^&gt;\s?/gm, "").trim()}</blockquote>`;
    });
    htmlContent = htmlContent.replace(/^&gt;\s*\[!CAUTION\]\s*([\s\S]*?)(?=\n\n|\n^[^&gt;]|$)/gim, (_, text) => {
      return `<blockquote class="alert-danger"><strong>CAUTION:</strong><br>${text.replace(/^&gt;\s?/gm, "").trim()}</blockquote>`;
    });

    // Regular Blockquotes
    htmlContent = htmlContent.replace(/^&gt;\s*(.*$)/gim, "<blockquote>$1</blockquote>");

    // Bold & Italics
    htmlContent = htmlContent.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    htmlContent = htmlContent.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // Lists
    htmlContent = htmlContent.replace(/^\s*-\s+(.*$)/gim, "<li>$1</li>");
    htmlContent = htmlContent.replace(/<li>(.*)<\/li>/g, (match) => {
      return `<ul>${match}</ul>`;
    });
    // Merge consecutive <ul> tags
    htmlContent = htmlContent.replace(/<\/ul>\s*<ul>/g, "");

    // Paragraphs (double newlines)
    htmlContent = htmlContent.replace(/\n\s*\n/g, "</p><p>");
    htmlContent = `<p>${htmlContent}</p>`;

    // Cleanup empty paragraphs
    htmlContent = htmlContent.replace(/<p>\s*<\/p>/g, "");

    return htmlContent;
  }

  render() {
    const parsedHtml = this.parseMarkdown(this.fileContent);

    return html`
      <div class="header-bar">
        <div class="selector-group">
          <label for="agentSelect">Agent Workspace</label>
          <select id="agentSelect" .value=${this.selectedAgentId} @change=${this.handleAgentChange}>
            ${this.agents.map(a => html`
              <option value=${a.id}>${a.name || a.id}</option>
            `)}
          </select>

          ${this.selectedFilename ? html`
            <span style="color: var(--text-muted)">/</span>
            <code style="font-size: 0.95rem; font-weight: bold; color: var(--accent-secondary)">${this.selectedFilename}</code>
          ` : ""}
        </div>

        <div style="display: flex; gap: 0.75rem; align-items: center">
          ${this.isSaving ? html`
            <span class="status-badge saving">💾 Saving...</span>
          ` : this.isModified ? html`
            <span class="status-badge modified">● Unsaved changes</span>
          ` : html`
            <span class="status-badge">✓ Saved</span>
          `}

          <button 
            class="btn btn-primary" 
            @click=${this.saveFile}
            ?disabled=${!this.selectedFilename || this.isSaving || !this.isModified}
          >
            💾 Save File
          </button>
        </div>
      </div>

      <div class="workspace">
        <!-- Files Sidebar -->
        <div class="sidebar">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem; margin-bottom: 0.5rem">
            <div class="sidebar-title" style="border: none; padding: 0; margin: 0">Workspace Markdown</div>
            <button class="btn" style="padding: 0.15rem 0.4rem; font-size: 0.75rem" @click=${this.createNewFile}>➕ New</button>
          </div>
          <div class="file-list">
            ${this.files.length === 0 ? html`
              <div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; padding: 1rem 0">
                No markdown files found
              </div>
            ` : this.files.map(filename => html`
              <div 
                class="file-item ${this.selectedFilename === filename ? "active" : ""}" 
                @click=${() => this.loadFile(filename)}
              >
                📄 ${filename}
              </div>
            `)}
          </div>
        </div>

        <!-- Editor Work Area -->
        <div class="editor-container">
          <div class="tab-bar">
            <button class="tab-btn ${this.activeTab === 'edit' ? 'active' : ''}" @click=${() => this.activeTab = 'edit'}>
              📝 Edit Source
            </button>
            <button class="tab-btn ${this.activeTab === 'preview' ? 'active' : ''}" @click=${() => this.activeTab = 'preview'}>
              👁️ HTML Preview
            </button>
            <button class="tab-btn ${this.activeTab === 'split' ? 'active' : ''}" @click=${() => this.activeTab = 'split'}>
              🌓 Side Split View
            </button>
          </div>

          <div class="editor-workspace ${this.activeTab === 'split' ? 'split' : ''}">
            ${this.activeTab === 'edit' || this.activeTab === 'split' ? html`
              <div class="editor-pane">
                <textarea 
                  .value=${this.fileContent}
                  @input=${this.handleEditorInput}
                  placeholder="Select a file from the sidebar to view and edit..."
                  ?disabled=${!this.selectedFilename}
                ></textarea>
              </div>
            ` : ""}

            ${this.activeTab === 'preview' || this.activeTab === 'split' ? html`
              <div class="preview-pane">
                ${this.selectedFilename ? html`
                  <div .innerHTML=${parsedHtml}></div>
                ` : html`
                  <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-style: italic">
                    Select a markdown file to display render preview
                  </div>
                `}
              </div>
            ` : ""}
          </div>
        </div>
      </div>
    `;
  }
}
