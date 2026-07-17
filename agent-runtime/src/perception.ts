import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import { ToolRegistry } from "./registry.js";
import { ModelProvider } from "./types.js";

export interface MediaUnderstandingResult {
  kind: string;
  extractedText?: string;
  description?: string;
  confidence: number;
  provider: string;
  nativePart?: {
    mimeType: string;
    data: string; // base64 string
  };
}

export async function understandMedia(
  attachment: {
    type: string;
    fileId: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    localPath?: string;
  },
  agentConfig: any,
  globalConfig: any,
  toolRegistry: ToolRegistry,
  modelProvider: ModelProvider
): Promise<MediaUnderstandingResult> {
  const mediaType = attachment.type; // "photo" | "voice" | "video" | "document" | "audio"
  const localPath = attachment.localPath;

  if (!localPath || !existsSync(localPath)) {
    return {
      kind: mediaType,
      confidence: 0.0,
      provider: "none",
      description: `[Error: Media file not found or not downloaded. ID: ${attachment.fileId}]`,
    };
  }

  // 1. Resolve resolution path priority
  const mode = resolveResolutionPath(mediaType, agentConfig, globalConfig, modelProvider.id);

  console.log(`[Perception] Resolving media ${mediaType} (${attachment.fileName || "unnamed"}) via: ${mode}`);

  // Path A: Native multimodal call
  if (mode === "native") {
    try {
      const mimeType = attachment.mimeType || getMimeType(mediaType, attachment.fileName);
      const data = readFileSync(localPath).toString("base64");
      return {
        kind: mediaType,
        confidence: 1.0,
        provider: "native",
        nativePart: { mimeType, data },
      };
    } catch (err: any) {
      console.warn(`[Perception] Native path failed: ${err.message}. Falling back to skill/local.`);
    }
  }

  // Path B: Specialist skill fallback
  const skillName = getSpecialistSkillName(mediaType);
  if (skillName && toolRegistry.has(skillName)) {
    try {
      console.log(`[Perception] Routing to specialist skill: ${skillName}`);
      const output = await toolRegistry.execute(skillName, { localPath }, {
        agentId: agentConfig.id,
        sessionId: "perception-temp",
        workspacePath: agentConfig.workspace,
        gatewayUrl: "",
        gatewayToken: "",
        rpcRequest: async () => ({})
      });
      return {
        kind: mediaType,
        extractedText: output,
        description: `Processed via skill ${skillName}`,
        confidence: 0.9,
        provider: `skill:${skillName}`,
      };
    } catch (err: any) {
      console.warn(`[Perception] Skill path ${skillName} failed: ${err.message}. Falling back to local.`);
    }
  }

  // Path C: CLI / local fallback
  try {
    const localResult = await runLocalFallback(mediaType, localPath, attachment.fileName);
    return {
      kind: mediaType,
      ...localResult,
      confidence: 0.7,
      provider: "local-cli",
    };
  } catch (err: any) {
    console.error(`[Perception] Local fallback failed: ${err.message}`);
    return {
      kind: mediaType,
      confidence: 0.1,
      provider: "degraded",
      description: `[Degraded processing: local processing failed. File size: ${attachment.fileSize || 0} bytes. Error: ${err.message}]`,
    };
  }
}

function resolveResolutionPath(mediaType: string, agentConfig: any, globalConfig: any, providerId: string): "native" | "skill" | "local" {
  // Check agent overrides first
  const agentMultimodal = agentConfig?.model?.multimodal || globalConfig?.models?.defaults?.multimodal;
  const overrides = agentMultimodal?.overrides || {};
  
  let mappedType = mediaType;
  if (mediaType === "photo") mappedType = "image";
  if (mediaType === "voice") mappedType = "audio";

  if (overrides[mappedType]) {
    return overrides[mappedType];
  }

  // Default heuristic: if model is gemini (Flash/Pro) and type is image/audio, native is supported.
  const modelName = (agentConfig?.model?.name || "").toLowerCase();
  const isGemini = providerId === "gemini" || modelName.includes("gemini");
  
  if (isGemini && (mappedType === "image" || mappedType === "audio")) {
    return "native";
  }

  // Default: try skill, fallback to local if skill not installed (handled by main understandMedia flow)
  return "skill";
}

function getSpecialistSkillName(mediaType: string): string | null {
  switch (mediaType) {
    case "voice":
    case "audio":
      return "audio-transcribe";
    case "photo":
      return "image-text-ocr";
    case "document":
      return "pdf-page-extract";
    default:
      return null;
  }
}

async function runLocalFallback(mediaType: string, localPath: string, fileName?: string): Promise<{ extractedText?: string; description?: string }> {
  if (mediaType === "voice" || mediaType === "audio") {
    // Check for ffmpeg
    let hasFfmpeg = false;
    try {
      execSync("ffmpeg -version", { stdio: "ignore" });
      hasFfmpeg = true;
    } catch {}

    if (!hasFfmpeg) {
      return {
        description: `[Audio fallback: ffmpeg is not installed. Degraded processing of audio file.]`,
      };
    }

    // Attempt to transcribe using whisper.cpp if present
    let whisperCommand = "";
    const possibleWhisperPaths = [
      "whisper-cli",
      "whisper",
      join(homedir(), "whisper.cpp", "main"),
    ];

    for (const cmd of possibleWhisperPaths) {
      try {
        execSync(`which ${cmd}`, { stdio: "ignore" });
        whisperCommand = cmd;
        break;
      } catch {}
    }

    if (!whisperCommand) {
      // Degrade gracefully with wave info or message
      return {
        description: `[Audio fallback: ffmpeg found but whisper.cpp not configured. Waveform details processed but transcription is unavailable.]`,
      };
    }

    // Run transcoding and transcription
    const tempWav = `${localPath}.wav`;
    try {
      execSync(`ffmpeg -y -i "${localPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${tempWav}"`, { stdio: "ignore" });
      
      const transcription = execSync(`"${whisperCommand}" -m ${join(homedir(), "whisper.cpp", "models", "ggml-base.bin")} -f "${tempWav}" --output-txt`, { encoding: "utf-8" });
      return {
        extractedText: transcription.trim(),
        description: "Transcribed locally via whisper.cpp",
      };
    } catch (err: any) {
      return {
        description: `[Audio fallback: Local transcription failed. Error: ${err.message}]`,
      };
    } finally {
      try {
        const fs = await import("node:fs");
        if (fs.existsSync(tempWav)) fs.unlinkSync(tempWav);
      } catch {}
    }
  }

  if (mediaType === "document" && fileName?.endsWith(".pdf")) {
    let hasPdfToText = false;
    try {
      execSync("which pdftotext", { stdio: "ignore" });
      hasPdfToText = true;
    } catch {}

    if (hasPdfToText) {
      try {
        const text = execSync(`pdftotext "${localPath}" -`, { encoding: "utf-8" });
        return {
          extractedText: text.trim(),
          description: "Extracted PDF text layer locally using pdftotext",
        };
      } catch (err: any) {
        return {
          description: `[Document fallback: pdftotext failed. Error: ${err.message}]`,
        };
      }
    }
  }

  // Fallback for photos/videos or unsupported documents
  return {
    description: `[Local fallback: Media type '${mediaType}' not natively supported by this model, and no local extractor available. File size: ${readFileSync(localPath).length} bytes]`,
  };
}

function getMimeType(mediaType: string, fileName?: string): string {
  if (mediaType === "photo") return "image/jpeg";
  if (mediaType === "voice") return "audio/ogg";
  if (mediaType === "audio") return "audio/mpeg";
  if (mediaType === "video") return "video/mp4";
  if (mediaType === "document") {
    if (fileName?.endsWith(".pdf")) return "application/pdf";
    return "text/plain";
  }
  return "application/octet-stream";
}
