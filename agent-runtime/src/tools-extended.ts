import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { homedir } from "node:os";
import { RegisteredTool } from "./types.js";

/**
 * Extended tool surface — appended to the core tools list.
 * These bring Komorebi Omoi agents to OpenClaw-class capability parity.
 */
export const extendedToolsList: RegisteredTool[] = [
  {
    definition: {
      name: "list_dir",
      description: "Lists the contents of a directory within your authorized workspace, returning a tree-style view of files and subdirectories.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path relative to workspace root. Use '.' for workspace root." },
          depth: { type: "number", description: "Maximum recursion depth (default 2, max 5)." },
        },
        required: ["path"],
      },
    },
    execute: async (args, context) => {
      const { readdirSync, statSync } = await import("node:fs");
      const target = resolve(context.workspacePath, args.path || ".");
      if (!existsSync(target)) return `Error: Directory not found: ${args.path}`;
      const maxDepth = Math.min(args.depth ?? 2, 5);
      const lines: string[] = [];
      function walk(dir: string, prefix: string, depth: number) {
        if (depth > maxDepth) return;
        let entries: any[];
        try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
        entries = entries.filter((e: any) => !e.name.startsWith("."));
        entries.forEach((entry: any, idx: number) => {
          const isLast = idx === entries.length - 1;
          const connector = isLast ? "└── " : "├── ";
          const childPrefix = isLast ? "    " : "│   ";
          try {
            const st = statSync(join(dir, entry.name));
            const size = entry.isDirectory() ? "" : ` (${(st.size / 1024).toFixed(1)}kb)`;
            lines.push(`${prefix}${connector}${entry.name}${size}`);
            if (entry.isDirectory()) walk(join(dir, entry.name), prefix + childPrefix, depth + 1);
          } catch {}
        });
      }
      lines.push(args.path || ".");
      walk(target, "", 1);
      return lines.join("\n") || "Empty directory.";
    },
  },

  {
    definition: {
      name: "append_file",
      description: "Appends text to the end of a file in your workspace. Creates the file if it doesn't exist.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to workspace root." },
          content: { type: "string", description: "Text content to append." },
        },
        required: ["path", "content"],
      },
    },
    execute: async (args, context) => {
      const { appendFileSync } = await import("node:fs");
      const target = resolve(context.workspacePath, args.path);
      const parentDir = dirname(target);
      if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
      appendFileSync(target, args.content, "utf-8");
      return `Success: Appended ${args.content.length} characters to ${args.path}`;
    },
  },

  {
    definition: {
      name: "think",
      description: "Internal reasoning scratchpad. Use this before complex multi-step decisions to reason step-by-step. Content is logged privately and not shown to the user in chat.",
      parameters: {
        type: "object",
        properties: {
          reasoning: { type: "string", description: "Your chain-of-thought reasoning, analysis, or action plan." },
        },
        required: ["reasoning"],
      },
    },
    execute: async (args, context) => {
      const { appendFileSync } = await import("node:fs");
      const today = new Date().toISOString().split("T")[0];
      const logDir = join(homedir(), ".komorebi", "agents", context.agentId, "memory");
      if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
      const logPath = join(logDir, `${today}-think.md`);
      appendFileSync(logPath, `\n## [${new Date().toLocaleTimeString()}]\n${args.reasoning}\n`, "utf-8");
      return `Reasoning logged. Proceed with your planned action.`;
    },
  },

  {
    definition: {
      name: "http_stream",
      description: "Fetches content from a URL with extended payload support. Returns the accumulated content up to maxChars. Useful for large API responses or streaming endpoints.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Target URL to fetch." },
          method: { type: "string", description: "HTTP method (GET or POST).", enum: ["GET", "POST"] },
          headers: { type: "object", description: "Request headers as a JSON object." },
          body: { type: "string", description: "Optional request body for POST." },
          maxChars: { type: "number", description: "Maximum characters to return (default 8000)." },
        },
        required: ["url"],
      },
    },
    execute: async (args) => {
      try {
        const res = await fetch(args.url, {
          method: args.method || "GET",
          headers: (args.headers as Record<string, string>) || {},
          body: args.body || undefined,
        });
        if (!res.ok) return `Error: HTTP ${res.status} ${res.statusText} from ${args.url}`;
        const maxChars = args.maxChars ?? 8000;
        const text = await res.text();
        return text.length > maxChars
          ? text.slice(0, maxChars) + `\n\n... [Truncated at ${maxChars} chars. Full length: ${text.length}]`
          : text;
      } catch (err: any) {
        return `Error: HTTP stream failed: ${err.message}`;
      }
    },
  },

  {
    definition: {
      name: "read_skill",
      description: "Reads the SKILL.md instruction playbook of an installed skill by its slug name, giving you full usage instructions for that capability pack.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "The skill slug (e.g. 'calendar', '@publisher/skill-name')." },
        },
        required: ["slug"],
      },
    },
    execute: async (args, context) => {
      const cleanSlug = args.slug.replace(/^@[^/]+\//, "");
      const searchPaths = [
        join(homedir(), ".komorebi", "agents", context.agentId, "skills", cleanSlug, "SKILL.md"),
        join(homedir(), ".komorebi", "shared-skills", cleanSlug, "SKILL.md"),
        join(resolve(context.workspacePath, "..", "..", "skills"), cleanSlug, "SKILL.md"),
      ];
      for (const p of searchPaths) {
        if (existsSync(p)) {
          const content = readFileSync(p, "utf-8");
          if (context.runtime) context.runtime.loadedSkills.add(args.slug.toLowerCase());
          return `# SKILL PLAYBOOK: ${args.slug}\n\n${content}`;
        }
      }
      return `Error: Skill '${args.slug}' not found in any skill directory. Use skills_search to find and install it.`;
    },
  },

  {
    definition: {
      name: "skills_search",
      description: "Searches the ClawHub registry for installable capability skill packs that match a natural language description of what you need.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Natural language capability description (e.g. 'google calendar integration', 'send email', 'pdf reader')." },
        },
        required: ["query"],
      },
    },
    execute: async (args, context) => {
      try {
        const baseUrl = context.gatewayUrl.replace(/^ws/, "http").replace(/\/ws(\?.*)?$/, "");
        const res = await fetch(`${baseUrl}/api/clawhub/search?q=${encodeURIComponent(args.query)}`, {
          headers: { Authorization: `Bearer ${context.gatewayToken}` },
        });
        if (!res.ok) return `Error: ClawHub search HTTP ${res.status}`;
        const data = await res.json() as any;
        const results = (data.results || []).slice(0, 8);
        if (results.length === 0) return `No ClawHub skills found for "${args.query}". Try different keywords.`;
        const lines = results.map((s: any) =>
          `• **${s.slug}** v${s.version} [${s.verified ? "✅ Verified" : "⚠ Unverified"}]\n  ${s.description}\n  Publisher: ${s.publisher} | ⭐ ${s.rating}/5 | ${s.price === 0 ? "Free" : "$" + s.price}`
        );
        return `ClawHub search results for "${args.query}":\n\n${lines.join("\n\n")}\n\nShare these options with the user, then install with the skills_install flow.`;
      } catch (err: any) {
        return `Error: ClawHub search failed: ${err.message}`;
      }
    },
  },

  {
    definition: {
      name: "generate_image",
      description: "Generates an image from a text prompt and returns the local file path to the generated image.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Text description of the image to generate." },
        },
        required: ["prompt"],
      },
    },
    execute: async (args, context) => {
      const { writeFileSync, mkdirSync } = await import("node:fs");
      const { join } = await import("node:path");
      
      const outputDir = join(context.workspacePath, "generated");
      mkdirSync(outputDir, { recursive: true });
      const outputPath = join(outputDir, `image_${Date.now()}.png`);
      
      try {
        console.log(`[generate_image] Generating image for prompt: "${args.prompt}"`);
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(args.prompt)}?width=512&height=512&nologo=true`;
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          writeFileSync(outputPath, buffer);
          return `SUCCESS: Image generated successfully. Local Path: ${outputPath}`;
        }
      } catch (err: any) {
        console.warn(`[generate_image] Online generation failed: ${err.message}. Creating fallback.`);
      }

      const mockSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
        <rect width="100%" height="100%" fill="#1e1e28"/>
        <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#a78bfa" font-weight="bold">Komorebi Image Gen</text>
        <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#9ca3af">${args.prompt.slice(0, 50)}...</text>
      </svg>`;
      const fallbackPath = outputPath.replace(".png", ".svg");
      writeFileSync(fallbackPath, mockSvg);
      return `SUCCESS: Fallback image created. Local Path: ${fallbackPath}`;
    }
  },

  {
    definition: {
      name: "text_to_speech",
      description: "Converts text to speech and returns the local file path to the generated audio voice note.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text content to speak." },
          language: { type: "string", description: "Optional language code (e.g. 'en', 'es')." },
        },
        required: ["text"],
      },
    },
    execute: async (args, context) => {
      const { writeFileSync, mkdirSync } = await import("node:fs");
      const { join } = await import("node:path");
      const { execSync } = await import("node:child_process");

      const outputDir = join(context.workspacePath, "generated");
      mkdirSync(outputDir, { recursive: true });
      const outputPath = join(outputDir, `audio_${Date.now()}.mp3`);

      try {
        const lang = args.language || "en";
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(args.text)}`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(10000)
        });
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          writeFileSync(outputPath, buffer);
          return `SUCCESS: Voice note generated successfully. Local Path: ${outputPath}`;
        }
      } catch (err: any) {
        console.warn(`[text_to_speech] Online TTS failed: ${err.message}. Falling back to local espeak.`);
      }

      try {
        execSync(`which espeak`, { stdio: "ignore" });
        const wavPath = outputPath.replace(".mp3", ".wav");
        execSync(`espeak -w "${wavPath}" "${args.text.replace(/"/g, '\\"')}"`);
        return `SUCCESS: Local speech generated via espeak. Local Path: ${wavPath}`;
      } catch (err: any) {
        return `Error: TTS generation failed completely. Espeak not installed. Text was: "${args.text}"`;
      }
    }
  }
];
