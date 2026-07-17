import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ContextSignal {
  signalType: "device-motion" | "time-of-day" | "location-hint" | "calendar-busy" | "custom";
  value: string;
  source: string;
  timestamp: number;
  ttl: number; // in seconds
}

export type SituationalMode = "active-desk" | "mobile-brief" | "do-not-disturb" | "unknown";

export class ContextSignalBus {
  private static instance: ContextSignalBus;
  private signalsMap = new Map<string, ContextSignal[]>(); // keyed by agentId

  private constructor() {
    this.loadSignals();
  }

  public static getInstance(): ContextSignalBus {
    if (!ContextSignalBus.instance) {
      ContextSignalBus.instance = new ContextSignalBus();
    }
    return ContextSignalBus.instance;
  }

  private getSavePath(): string {
    return join(homedir(), ".komorebi", "context-signals.json");
  }

  private loadSignals() {
    const path = this.getSavePath();
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, "utf-8");
        const parsed = JSON.parse(raw);
        for (const agentId of Object.keys(parsed)) {
          this.signalsMap.set(agentId, parsed[agentId]);
        }
      } catch (err) {
        console.error("[ContextSignalBus] Failed to load saved signals:", err);
      }
    }
  }

  private saveSignals() {
    const path = this.getSavePath();
    try {
      const obj: Record<string, ContextSignal[]> = {};
      for (const [agentId, list] of this.signalsMap.entries()) {
        obj[agentId] = list;
      }
      writeFileSync(path, JSON.stringify(obj, null, 2), "utf-8");
    } catch (err) {
      console.error("[ContextSignalBus] Failed to save signals:", err);
    }
  }

  public publish(agentId: string, signal: Omit<ContextSignal, "timestamp"> & { timestamp?: number }) {
    const fullSignal: ContextSignal = {
      ...signal,
      timestamp: signal.timestamp || Date.now(),
    };

    let list = this.signalsMap.get(agentId) || [];
    // Filter out previous signals of the same type to keep it clean
    list = list.filter((s) => s.signalType !== fullSignal.signalType);
    list.push(fullSignal);
    this.signalsMap.set(agentId, list);
    this.saveSignals();

    console.log(`[ContextSignalBus] Signal published for agent '${agentId}':`, JSON.stringify(fullSignal));
  }

  public getActiveSignals(agentId: string): ContextSignal[] {
    const list = this.signalsMap.get(agentId) || [];
    const now = Date.now();
    
    // Filter out expired signals
    const active = list.filter((s) => {
      const expiryTime = s.timestamp + (s.ttl * 1000);
      return expiryTime > now;
    });

    if (active.length !== list.length) {
      this.signalsMap.set(agentId, active);
      this.saveSignals();
    }

    return active;
  }

  public resolveSituationalContext(agentId: string): SituationalMode {
    const activeSignals = this.getActiveSignals(agentId);
    if (activeSignals.length === 0) {
      return "unknown";
    }

    // Rule 1: Do Not Disturb
    const dndSignal = activeSignals.find(
      (s) =>
        s.signalType === "calendar-busy" &&
        (s.value.toLowerCase() === "busy" || s.value.toLowerCase() === "dnd" || s.value.toLowerCase() === "do-not-disturb")
    ) || activeSignals.find(
      (s) =>
        s.signalType === "custom" &&
        (s.value.toLowerCase() === "dnd" || s.value.toLowerCase() === "do-not-disturb" || s.value.toLowerCase() === "busy")
    );
    if (dndSignal) {
      return "do-not-disturb";
    }

    // Rule 2: Mobile Brief
    const mobileSignal = activeSignals.find(
      (s) =>
        s.signalType === "device-motion" &&
        (s.value.toLowerCase() === "walking" || s.value.toLowerCase() === "driving" || s.value.toLowerCase() === "mobile")
    ) || activeSignals.find(
      (s) =>
        s.signalType === "location-hint" &&
        (s.value.toLowerCase() === "outside" || s.value.toLowerCase() === "mobile" || s.value.toLowerCase() === "transit")
    );
    if (mobileSignal) {
      return "mobile-brief";
    }

    // Rule 3: Active Desk
    const deskSignal = activeSignals.find(
      (s) =>
        s.signalType === "location-hint" &&
        (s.value.toLowerCase() === "desk" || s.value.toLowerCase() === "home" || s.value.toLowerCase() === "office")
    );
    if (deskSignal) {
      return "active-desk";
    }

    return "unknown";
  }

  public getHistory(agentId: string): ContextSignal[] {
    return this.signalsMap.get(agentId) || [];
  }
}
