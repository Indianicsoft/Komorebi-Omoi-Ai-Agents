import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

export interface SkillManifest {
  name: string;
  description: string;
  version: string;
  publisher: string;
  rating: number;
  price: number;
  verified: boolean;
  category: string;
  permissions: {
    allowedTools: string[];
    networkAccess: boolean;
  };
}

export interface RegistrySkill {
  slug: string;
  name: string;
  description: string;
  version: string;
  publisher: string;
  rating: number;
  price: number;
  verified: boolean;
  category: string;
  installCount: number;
  permissions: {
    allowedTools: string[];
    networkAccess: boolean;
  };
}

export interface LockInfo {
  slug: string;
  version: string;
  source: string;
  type?: "skill" | "plugin";
  installedAt: string;
}

export interface LockFile {
  installs: Record<string, LockInfo>;
}

// ClawHub Cache implementation
export class ClawHubCache {
  private cacheDir: string;
  private ttlMs = 15 * 60 * 1000; // 15 minutes

  constructor() {
    this.cacheDir = join(homedir(), ".komorebi", ".clawhub-cache");
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  public get(key: string): any | null {
    const safeKey = crypto.createHash("md5").update(key).digest("hex");
    const cacheFile = join(this.cacheDir, `${safeKey}.json`);
    if (!existsSync(cacheFile)) return null;

    try {
      const data = JSON.parse(readFileSync(cacheFile, "utf-8"));
      if (Date.now() - data.timestamp > this.ttlMs) {
        rmSync(cacheFile, { force: true });
        return null;
      }
      return data.value;
    } catch {
      return null;
    }
  }

  public set(key: string, value: any): void {
    const safeKey = crypto.createHash("md5").update(key).digest("hex");
    const cacheFile = join(this.cacheDir, `${safeKey}.json`);
    try {
      writeFileSync(cacheFile, JSON.stringify({ timestamp: Date.now(), value }), "utf-8");
    } catch (err) {
      console.error("[ClawHubCache] Failed to write cache:", err);
    }
  }
}

// ClawHubClient wrapping real API calls
export class ClawHubClient {
  private cache = new ClawHubCache();
  private registryUrl = "https://clawhub.ai/api/v1";

  private async fetchJson(url: string): Promise<any> {
    if (typeof fetch !== "undefined") {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
      return await res.json();
    } else {
      const output = execSync(`curl -s "${url}"`, { encoding: "utf-8" });
      return JSON.parse(output);
    }
  }

  public async search(query: string, filters: { category?: string; verifiedOnly?: boolean } = {}): Promise<RegistrySkill[]> {
    const cacheKey = `search:${query}:${JSON.stringify(filters)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const url = query 
      ? `${this.registryUrl}/search?q=${encodeURIComponent(query)}&limit=25`
      : `${this.registryUrl}/skills`;

    try {
      const data = await this.fetchJson(url);
      const rawResults = data.results || [];
      
      let results: RegistrySkill[] = rawResults.map((item: any) => ({
        slug: `@${item.ownerHandle}/${item.slug}`,
        name: item.slug,
        description: item.summary || item.description || "No description provided.",
        version: item.version || "1.0.0",
        publisher: item.owner?.displayName || item.ownerHandle || "Unknown",
        rating: 4.5,
        price: 0,
        verified: (item.downloads || 0) > 100,
        category: (item.topics && item.topics[0]) || "Utility",
        installCount: item.downloads || 0,
        permissions: {
          allowedTools: ["read_file", "write_file"],
          networkAccess: true
        }
      }));

      if (filters.category) {
        results = results.filter(s => s.category.toLowerCase() === filters.category!.toLowerCase());
      }

      if (filters.verifiedOnly) {
        results = results.filter(s => s.verified);
      }

      this.cache.set(cacheKey, results);
      return results;
    } catch (err: any) {
      console.error("[ClawHubClient] Search failed:", err.message);
      return [];
    }
  }

  public async info(slug: string): Promise<RegistrySkill | null> {
    const cacheKey = `info:${slug}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    let owner = "";
    let name = slug;
    if (slug.includes("/")) {
      const parts = slug.replace(/^@/, "").split("/");
      owner = parts[0];
      name = parts[1];
    } else {
      const matches = await this.search(slug);
      if (matches.length > 0) {
        const best = matches.find(m => m.name === slug) || matches[0];
        this.cache.set(cacheKey, best);
        return best;
      }
      return null;
    }

    const matches = await this.search(name);
    const skill = matches.find(s => s.slug === slug || s.slug === `@${owner}/${name}`);
    if (skill) {
      this.cache.set(cacheKey, skill);
      return skill;
    }
    return null;
  }

  public resolveVersion(slug: string, versionSpec?: string): string {
    return "latest";
  }

  public downloadRealSkill(slug: string, targetPath: string): void {
    let owner = "";
    let name = slug;
    if (slug.includes("/")) {
      const parts = slug.replace(/^@/, "").split("/");
      owner = parts[0];
      name = parts[1];
    } else {
      throw new Error(`Ambiguous or invalid skill slug format: ${slug}. Expected @owner/slug`);
    }

    mkdirSync(targetPath, { recursive: true });
    const zipPath = `${targetPath}.zip`;
    const url = `${this.registryUrl}/download?slug=${encodeURIComponent(name)}&owner=${encodeURIComponent(owner)}`;
    console.log(`[ClawHubClient] Downloading skill from: ${url}`);
    
    try {
      execSync(`curl -s -L -o "${zipPath}" "${url}"`);
      if (!existsSync(zipPath)) {
        throw new Error("Failed to download package zip file.");
      }
      
      execSync(`unzip -o "${zipPath}" -d "${targetPath}"`);
    } finally {
      if (existsSync(zipPath)) {
        rmSync(zipPath, { force: true });
      }
    }
  }
}

// Static scan security engine
export interface SecurityScanResult {
  passed: boolean;
  warnings: string[];
  errors: string[];
}

export function scanSkillFiles(dir: string, manifest: SkillManifest): SecurityScanResult {
  const result: SecurityScanResult = { passed: true, warnings: [], errors: [] };
  
  if (!existsSync(dir)) {
    result.passed = false;
    result.errors.push("Skill directory does not exist.");
    return result;
  }

  const checkFile = (filePath: string) => {
    // Skip checking trust.json or other metadata
    if (filePath.includes(".trust")) return;
    
    const content = readFileSync(filePath, "utf-8");
    
    // Check 1: eval on remote content
    if (/eval\s*\(/i.test(content)) {
      if (content.includes("fetch") || content.includes("http") || content.includes("socket") || content.includes("axios")) {
        result.passed = false;
        result.errors.push(`Critical security violation: 'eval()' on remote content found in ${filePath}`);
      } else {
        result.passed = false;
        result.errors.push(`Suspicious 'eval()' call found in ${filePath}`);
      }
    }

    // Check 2: exec calls
    if (/exec\s*\(/i.test(content) || /execSync\s*\(/i.test(content)) {
      if (!manifest.permissions.allowedTools.includes("exec")) {
        result.passed = false;
        result.errors.push(`Suspicious shell command execution 'exec()' call found in ${filePath} without declared tool permission.`);
      }
    }

    // Check 3: Undeclared outbound network calls
    if (/fetch\s*\(/i.test(content) || /http\.get\s*\(/i.test(content) || /axios\./i.test(content) || /WebSocket\s*\(/i.test(content)) {
      if (!manifest.permissions.networkAccess) {
        result.passed = false;
        result.errors.push(`Potential outbound network call found in ${filePath} but 'networkAccess' is set to false in the manifest.`);
      }
    }

    // Check 4: Credential harvesting
    const credPatterns = [/id_rsa/i, /\.env/i, /passwd/i, /\.bash_history/i, /\.git\/config/i];
    for (const pat of credPatterns) {
      if (pat.test(content) && (content.includes("readFile") || content.includes("read_file") || content.includes("readFileSync"))) {
        result.passed = false;
        result.errors.push(`Credential-harvesting pattern: reading sensitive path matching '${pat.toString()}' in ${filePath}`);
      }
    }

    // Check 5: Obfuscated code
    if (isObfuscatedCode(content)) {
      result.passed = false;
      result.errors.push(`Obfuscated or encrypted code pattern detected in ${filePath}`);
    }
  };

  const scanRecursive = (currentDir: string) => {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        scanRecursive(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".sh") || entry.name.endsWith(".js") || entry.name.endsWith(".ts"))) {
        checkFile(fullPath);
      }
    }
  };

  try {
    scanRecursive(dir);
  } catch (err: any) {
    result.passed = false;
    result.errors.push(`Static scan failed: ${err.message}`);
  }

  return result;
}

function isObfuscatedCode(content: string): boolean {
  // Line lengths check
  const lines = content.split("\n");
  if (lines.length > 0) {
    const longLines = lines.filter(l => l.length > 2000);
    if (longLines.length > 0 && lines.length < 5) {
      return true;
    }
  }

  // String.fromCharCode check
  if (/String\.fromCharCode/i.test(content) && content.includes("[")) {
    return true;
  }

  // Excessive hex escapes (e.g. \x41)
  const hexEscapes = content.match(/\\x[0-9a-fA-F]{2}/g);
  if (hexEscapes && hexEscapes.length > 20) {
    return true;
  }

  return false;
}

export function getFolderHashes(dir: string, relativeRoot = ""): Record<string, string> {
  const hashes: Record<string, string> = {};
  const scan = (currentDir: string, relPath: string) => {
    if (!existsSync(currentDir)) return;
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue; // skip hidden folders/files
      const fullPath = join(currentDir, entry.name);
      const nextRel = relPath ? `${relPath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        scan(fullPath, nextRel);
      } else if (entry.isFile()) {
        try {
          const content = readFileSync(fullPath);
          const hash = crypto.createHash("sha256").update(content).digest("hex");
          hashes[nextRel] = hash;
        } catch {}
      }
    }
  };
  scan(dir, relativeRoot);
  return hashes;
}

export class TrustVerifier {
  public static verify(
    dir: string,
    manifest: SkillManifest,
    options: { previousTrust?: any; acceptRisk?: boolean } = {}
  ): { score: "VERIFIED" | "TRUSTED" | "UNKNOWN" | "SUSPICIOUS" | "UNTRUSTED"; findings: string[]; hashes: Record<string, string> } {
    const findings: string[] = [];
    let score: "VERIFIED" | "TRUSTED" | "UNKNOWN" | "SUSPICIOUS" | "UNTRUSTED" = "TRUSTED";

    // 1. Publisher reputation
    const flaggedPublishers = ["scam_publisher", "malicious_dev", "hacker"];
    const verifiedPublishers = ["ClawHub Verified", "Official Komorebi", "Komorebi Omoi Team"];

    if (flaggedPublishers.includes(manifest.publisher.toLowerCase())) {
      findings.push(`Publisher '${manifest.publisher}' is blacklisted.`);
      score = "UNTRUSTED";
    } else if (verifiedPublishers.includes(manifest.publisher) || manifest.verified) {
      score = "VERIFIED";
    } else {
      findings.push(`Publisher '${manifest.publisher}' is unverified.`);
      score = "UNKNOWN";
    }

    // 2. Version consistency
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      findings.push(`Version '${manifest.version}' does not match standard semver pattern.`);
      if (score !== "UNTRUSTED") score = "SUSPICIOUS";
    }

    if (options.previousTrust) {
      const prevManifest = options.previousTrust.manifest;
      if (prevManifest) {
        // Compare tools
        const prevTools = prevManifest.permissions?.allowedTools || [];
        const nextTools = manifest.permissions?.allowedTools || [];
        const toolJump = nextTools.filter(t => !prevTools.includes(t));
        if (toolJump.length > 0) {
          findings.push(`Permission scope jump: added tools ${JSON.stringify(toolJump)}.`);
          if (score !== "UNTRUSTED") score = "SUSPICIOUS";
        }
        // Compare network access
        if (manifest.permissions?.networkAccess && !prevManifest.permissions?.networkAccess) {
          findings.push(`Permission scope jump: networkAccess enabled.`);
          if (score !== "UNTRUSTED") score = "SUSPICIOUS";
        }
      }
    }

    // 3. Content Integrity
    const hashes = getFolderHashes(dir);
    if (options.previousTrust && options.previousTrust.hashes) {
      const prevHashes = options.previousTrust.hashes;
      let hashMismatch = false;
      for (const [file, hash] of Object.entries(hashes)) {
        if (file.startsWith(".trust/")) continue;
        if (prevHashes[file] && prevHashes[file] !== hash) {
          findings.push(`Content mismatch for file: ${file}`);
          hashMismatch = true;
        }
      }
      if (hashMismatch) {
        findings.push("Supply-chain content mismatch (drift/tampering).");
        if (score !== "UNTRUSTED") score = "SUSPICIOUS";
      }
    }

    // 4. Dependency chain
    const deps = (manifest as any).dependencies || [];
    const unsafeDeps = deps.filter((d: string) => d.includes("malicious") || d.includes("scam") || d.includes("flagged"));
    if (unsafeDeps.length > 0) {
      findings.push(`Dependency chain contains flagged packages: ${JSON.stringify(unsafeDeps)}.`);
      if (score !== "UNTRUSTED") score = "SUSPICIOUS";
    }

    // 5. Static pattern scan
    const scanResult = scanSkillFiles(dir, manifest);
    for (const err of scanResult.errors) {
      findings.push(`Security: ${err}`);
      score = "UNTRUSTED";
    }
    for (const warn of scanResult.warnings) {
      findings.push(`Warning: ${warn}`);
      if (score !== "UNTRUSTED") score = "SUSPICIOUS";
    }

    return { score, findings, hashes };
  }
}

// Parse frontmatter metadata
export function parseSkillManifest(skillMdContent: string): SkillManifest {
  const match = skillMdContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error("Invalid frontmatter metadata header in SKILL.md. Expected matching triple hyphens block.");
  }

  const lines = match[1].split("\n");
  const parsed: any = { permissions: { allowedTools: ["read_file", "write_file"], networkAccess: true } };

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();

    if (key === "permissions") continue;
    
    if (line.startsWith("  allowedTools:")) {
      try {
        parsed.permissions.allowedTools = JSON.parse(val);
      } catch {
        parsed.permissions.allowedTools = val.replace(/[\[\]"]/g, "").split(",").map(s => s.trim());
      }
    } else if (line.startsWith("  networkAccess:")) {
      parsed.permissions.networkAccess = val === "true";
    } else if (key === "metadata") {
      try {
        parsed.metadata = JSON.parse(val);
      } catch {}
    } else {
      if (key === "rating" || key === "price") {
        parsed[key] = parseFloat(val);
      } else if (key === "verified") {
        parsed[key] = val === "true";
      } else {
        parsed[key] = val.replace(/^["']|["']$/g, "");
      }
    }
  }

  if (!parsed.name) parsed.name = "unknown";
  if (!parsed.description) parsed.description = "No description provided.";
  if (!parsed.version) parsed.version = "1.0.0";
  if (!parsed.publisher) parsed.publisher = "Community";
  if (parsed.rating === undefined) parsed.rating = 4.5;
  if (parsed.price === undefined) parsed.price = 0;
  if (parsed.verified === undefined) parsed.verified = false;
  if (!parsed.category) parsed.category = "Utility";

  return parsed as SkillManifest;
}

// Skill installation/pipeline manager
export class SkillInstaller {
  private client = new ClawHubClient();

  constructor(private readonly projectRoot: string) {}

  public async install(source: string, options: { agentId?: string; global?: boolean; version?: string; force?: boolean }): Promise<{ success: boolean; message: string; manifest?: SkillManifest }> {
    let slug = "";
    let isGit = false;
    let isLocal = false;
    let localPath = "";
    let version = options.version || "latest";

    if (source.startsWith("git:")) {
      isGit = true;
      slug = source.slice(4);
    } else if (source.startsWith("/") || source.startsWith("./") || source.startsWith("../")) {
      isLocal = true;
      localPath = source;
      slug = "local-" + crypto.createHash("md5").update(source).digest("hex").slice(0, 8);
    } else {
      slug = source;
    }

    let targetSkillsDir: string;
    let targetPluginsDir: string;
    if (options.global) {
      targetSkillsDir = join(homedir(), ".komorebi", "shared-skills");
      targetPluginsDir = join(homedir(), ".komorebi", "shared-plugins");
    } else {
      if (!options.agentId) {
        return { success: false, message: "Error: Agent ID must be specified for workspace scoped packages." };
      }
      targetSkillsDir = join(homedir(), ".komorebi", "agents", options.agentId, "skills");
      targetPluginsDir = join(homedir(), ".komorebi", "agents", options.agentId, "plugins");
    }

    const skillName = slug.split("/").pop() || slug;

    const configPath = join(homedir(), ".komorebi", "komorebi.json");
    let purchasedLicenses: string[] = [];
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, "utf-8"));
        purchasedLicenses = config.licenses || [];
      } catch {}
    }

    const tempDownloadDir = join(homedir(), ".komorebi", ".clawhub-temp", skillName);
    if (existsSync(tempDownloadDir)) {
      rmSync(tempDownloadDir, { recursive: true, force: true });
    }
    mkdirSync(tempDownloadDir, { recursive: true });

    try {
      if (isLocal) {
        const srcSkillMd = join(localPath, "SKILL.md");
        const srcPluginJson = join(localPath, "plugin.json");
        const srcManifestJson = join(localPath, "manifest.json");
        if (!existsSync(srcSkillMd) && !existsSync(srcPluginJson) && !existsSync(srcManifestJson)) {
          return { success: false, message: `Error: No SKILL.md or plugin.json found at root of directory: ${localPath}` };
        }
        execSync(`cp -r "${localPath}"/* "${tempDownloadDir}/"`);
      } else if (isGit) {
        writeFileSync(join(tempDownloadDir, "SKILL.md"), `---
name: ${skillName}
description: Git-sourced capability
version: 1.0.0
publisher: Git Community
rating: 4.0
price: 0
verified: false
category: Utility
permissions:
  allowedTools: ["read_file"]
  networkAccess: true
---
# Skill playbook: ${skillName}
`, "utf-8");
      } else {
        let info = await this.client.info(slug);
        if (!info) {
          const searchRes = await this.client.search(slug);
          if (searchRes.length > 0) {
            info = searchRes[0];
            slug = info.slug;
          } else {
            return { success: false, message: `Error: Skill ${slug} not found in ClawHub registry.` };
          }
        }
        if (info.price > 0 && !purchasedLicenses.includes(slug)) {
          return { success: false, message: `Error: Purchase required for paid skill. Buy here: https://clawhub.ai/skills/${skillName}` };
        }
        this.client.downloadRealSkill(slug, tempDownloadDir);
      }

      // Auto-detect if it's a plugin or skill based on file layout
      const isPlugin = existsSync(join(tempDownloadDir, "plugin.json")) || existsSync(join(tempDownloadDir, "manifest.json"));
      const destDir = isPlugin 
        ? join(targetPluginsDir, skillName)
        : join(targetSkillsDir, skillName);

      if (existsSync(destDir) && !options.force) {
        return { success: false, message: `Error: Package directory already exists at ${destDir}. Use --force to overwrite.` };
      }

      let manifest: SkillManifest;
      if (isPlugin) {
        const pluginJsonPath = existsSync(join(tempDownloadDir, "plugin.json"))
          ? join(tempDownloadDir, "plugin.json")
          : join(tempDownloadDir, "manifest.json");
        const jsonContent = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
        manifest = {
          name: jsonContent.name || skillName,
          description: jsonContent.description || "No description provided.",
          version: jsonContent.version || "1.0.0",
          publisher: jsonContent.publisher || "Community",
          rating: jsonContent.rating || 4.5,
          price: jsonContent.price || 0,
          verified: jsonContent.verified || false,
          category: jsonContent.category || "Plugin",
          permissions: jsonContent.permissions || { allowedTools: ["read_file", "write_file"], networkAccess: true }
        };
      } else {
        const skillMdPath = join(tempDownloadDir, "SKILL.md");
        if (!existsSync(skillMdPath)) {
          return { success: false, message: "Error: Package is missing required SKILL.md or plugin.json." };
        }
        manifest = parseSkillManifest(readFileSync(skillMdPath, "utf-8"));
      }

      if (options.agentId) {
        const agentConfigPath = join(homedir(), ".komorebi", "agents", options.agentId, "agent.config.json");
        if (existsSync(agentConfigPath)) {
          const agentConfig = JSON.parse(readFileSync(agentConfigPath, "utf-8"));
          const allowedTools = agentConfig.toolPolicy?.allowedTools || agentConfig.tools || [];
          for (const requiredTool of manifest.permissions.allowedTools) {
            if (allowedTools.length > 0 && !allowedTools.includes(requiredTool) && !allowedTools.includes("*")) {
              return { 
                success: false, 
                message: `Error: Security policy violation. Package '${manifest.name}' requests permission to use tool '${requiredTool}' which is denied for agent '${options.agentId}'.` 
              };
            }
          }
        }
      }

      const trustJsonPath = join(destDir, ".trust", "trust.json");
      let previousTrust: any = null;
      if (existsSync(trustJsonPath)) {
        try {
          previousTrust = JSON.parse(readFileSync(trustJsonPath, "utf-8"));
        } catch {}
      }

      const verifyResult = TrustVerifier.verify(tempDownloadDir, manifest, {
        previousTrust,
        acceptRisk: options.force || (options as any).acceptRisk
      });

      if (verifyResult.score === "UNTRUSTED") {
        return {
          success: false,
          message: `Error: Security scan rejected this package install. Reasons: ${verifyResult.findings.join("; ")}`
        };
      }

      if (verifyResult.score === "SUSPICIOUS" && !(options as any).acceptRisk) {
        return {
          success: false,
          message: `Error: Security scan rejected this package install. Reasons: ${verifyResult.findings.join("; ")}. To proceed, run with --accept-risk.`
        };
      }

      if (verifyResult.score === "UNKNOWN") {
        const confirmedPubsPath = join(homedir(), ".komorebi", "confirmed-publishers.json");
        let confirmedPublishers: string[] = [];
        if (existsSync(confirmedPubsPath)) {
          try {
            confirmedPublishers = JSON.parse(readFileSync(confirmedPubsPath, "utf-8"));
          } catch {}
        }
        const isConfirmed = confirmedPublishers.includes(manifest.publisher);
        if (!isConfirmed && !(options as any).acceptRisk) {
          return {
            success: false,
            message: `Confirmation Required: Publisher '${manifest.publisher}' is UNKNOWN. Re-run with --accept-risk to confirm.`
          };
        }
        if (!confirmedPublishers.includes(manifest.publisher)) {
          confirmedPublishers.push(manifest.publisher);
          try {
            mkdirSync(dirname(confirmedPubsPath), { recursive: true });
            writeFileSync(confirmedPubsPath, JSON.stringify(confirmedPublishers, null, 2), "utf-8");
          } catch {}
        }
      }

      if (existsSync(destDir)) {
        rmSync(destDir, { recursive: true, force: true });
      }
      mkdirSync(dirname(destDir), { recursive: true });
      execSync(`cp -r "${tempDownloadDir}" "${destDir}"`);

      // Write trust attestation
      const trustDir = join(destDir, ".trust");
      mkdirSync(trustDir, { recursive: true });
      const attestation = {
        manifest,
        score: verifyResult.score,
        findings: verifyResult.findings,
        hashes: verifyResult.hashes,
        timestamp: new Date().toISOString(),
      };
      writeFileSync(join(trustDir, "trust.json"), JSON.stringify(attestation, null, 2), "utf-8");

      // Write lock file
      const lockFilePath = options.global 
        ? join(homedir(), ".komorebi", "shared-skills", ".clawhub", "lock.json")
        : join(homedir(), ".komorebi", "agents", options.agentId!, ".clawhub", "lock.json");

      mkdirSync(dirname(lockFilePath), { recursive: true });
      let lockData: LockFile = { installs: {} };
      if (existsSync(lockFilePath)) {
        try {
          lockData = JSON.parse(readFileSync(lockFilePath, "utf-8"));
        } catch {}
      }

      lockData.installs[manifest.name] = {
        slug: isGit ? `git:${slug}` : isLocal ? "local" : slug,
        version: manifest.version,
        source: isGit ? "git" : isLocal ? "local" : "clawhub",
        type: isPlugin ? "plugin" : "skill",
        installedAt: new Date().toISOString()
      };
      writeFileSync(lockFilePath, JSON.stringify(lockData, null, 2), "utf-8");

      return { 
        success: true, 
        message: `Successfully installed ${isPlugin ? "plugin" : "skill"} '${manifest.name}' (v${manifest.version}) to ${options.global ? "global scope" : "agent workspace: " + options.agentId}`, 
        manifest 
      };
    } finally {
      if (existsSync(tempDownloadDir)) {
        rmSync(tempDownloadDir, { recursive: true, force: true });
      }
    }
  }

  public async update(options: { agentId?: string; allAgents?: boolean }): Promise<{ success: boolean; message: string; updatedSkills?: Array<{ agentId: string; skillName: string; skillPath: string }> }> {
    let agentsToUpdate: string[] = [];
    if (options.allAgents) {
      const configPath = join(homedir(), ".komorebi", "komorebi.json");
      if (existsSync(configPath)) {
        try {
          const config = JSON.parse(readFileSync(configPath, "utf-8"));
          agentsToUpdate = (config.agents || []).map((a: any) => a.id);
        } catch {}
      }
    } else if (options.agentId) {
      agentsToUpdate = [options.agentId];
    } else {
      return { success: false, message: "Error: Specify --agent <id> or --all-agents." };
    }

    let updatedCount = 0;
    const updatedSkills: Array<{ agentId: string; skillName: string; skillPath: string }> = [];

    for (const agentId of agentsToUpdate) {
      const lockFilePath = join(homedir(), ".komorebi", "agents", agentId, ".clawhub", "lock.json");
      if (!existsSync(lockFilePath)) continue;

      const targetSkillsDir = join(homedir(), ".komorebi", "agents", agentId, "skills");
      const targetPluginsDir = join(homedir(), ".komorebi", "agents", agentId, "plugins");

      let lockData: LockFile;
      try {
        lockData = JSON.parse(readFileSync(lockFilePath, "utf-8"));
      } catch {
        continue;
      }

      for (const [skillName, installInfo] of Object.entries(lockData.installs)) {
        const currentSkillDir = installInfo.type === "plugin"
          ? join(targetPluginsDir, skillName)
          : join(targetSkillsDir, skillName);

        const currentTrustJson = join(currentSkillDir, ".trust", "trust.json");
        if (existsSync(currentTrustJson)) {
          try {
            const trustData = JSON.parse(readFileSync(currentTrustJson, "utf-8"));
            const currentHashes = getFolderHashes(currentSkillDir);
            
            // Remove the .trust folder from checking
            for (const key of Object.keys(currentHashes)) {
              if (key.startsWith(".trust/")) {
                delete currentHashes[key];
              }
            }

            let mismatch = false;
            for (const [file, hash] of Object.entries(currentHashes)) {
              if (trustData.hashes[file] !== hash) {
                mismatch = true;
                break;
              }
            }

            if (mismatch) {
              console.error(`[Watchdog] Security breach warning! Local files for skill '${skillName}' have been modified after installation.`);
              trustData.score = "SUSPICIOUS";
              trustData.findings.push("Drift detected: files modified on disk after installation.");
              writeFileSync(currentTrustJson, JSON.stringify(trustData, null, 2), "utf-8");
              continue; // Block update
            }
          } catch (err: any) {
            console.error(`[Watchdog] Failed to verify integrity of '${skillName}' during update:`, err.message);
          }
        }

        if (installInfo.source !== "clawhub") continue;

        const info = await this.client.info(installInfo.slug);
        if (info && info.version !== installInfo.version) {
          const res = await this.install(installInfo.slug, { agentId, version: info.version, force: true });
          if (res.success) {
            updatedCount++;
            const isPlugin = installInfo.type === "plugin";
            const skillPath = isPlugin
              ? join(homedir(), ".komorebi", "agents", agentId, "plugins", skillName)
              : join(homedir(), ".komorebi", "agents", agentId, "skills", skillName);
            updatedSkills.push({ agentId, skillName, skillPath });
          }
        }
      }
    }

    return { success: true, message: `Finished checking updates. Updated ${updatedCount} skills.`, updatedSkills };
  }
}
