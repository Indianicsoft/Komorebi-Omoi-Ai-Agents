import { randomUUID } from "node:crypto";

type TaskFn<T = any> = () => Promise<T>;

interface QueueItem {
  id: string;
  taskFn: TaskFn;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

/**
 * LaneCommandQueue handles running tasks with concurrency controls:
 * 1. Per-session concurrency is strictly 1 (sequential message execution per agent).
 * 2. Max global active tasks limit (concurrency limit across all agents).
 * 3. Max active agent limit (corresponds to our max 10 agents on Pi 5).
 */
export class LaneCommandQueue {
  private sessionQueues = new Map<string, QueueItem[]>();
  private activeSessions = new Set<string>();
  private globalActiveCount = 0;

  constructor(
    private readonly maxGlobalConcurrency: number = 10,
    private readonly maxAgentConcurrency: number = 10
  ) {}

  /**
   * Enqueues a task for a given agent session and returns a promise that resolves
   * when the task completes.
   */
  public enqueue<T>(sessionId: string, taskFn: TaskFn<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const item: QueueItem = {
        id: randomUUID(),
        taskFn,
        resolve,
        reject,
      };

      let queue = this.sessionQueues.get(sessionId);
      if (!queue) {
        queue = [];
        this.sessionQueues.set(sessionId, queue);
      }
      queue.push(item);

      // Trigger queue execution loop
      this.processNext();
    });
  }

  /**
   * Evaluates the queues and runs pending tasks if concurrency limits allow.
   */
  private processNext() {
    // Stop if we hit the global concurrency limit
    if (this.globalActiveCount >= this.maxGlobalConcurrency) {
      return;
    }
    // Stop if active agent processes limit is reached
    if (this.activeSessions.size >= this.maxAgentConcurrency) {
      return;
    }

    // Traverse queues to find work
    for (const [sessionId, queue] of this.sessionQueues.entries()) {
      if (queue.length === 0) {
        continue;
      }
      // Session is already executing a task (enforce sequential per-session limit of 1)
      if (this.activeSessions.has(sessionId)) {
        continue;
      }

      const item = queue.shift()!;
      this.activeSessions.add(sessionId);
      this.globalActiveCount++;

      // Execute task
      (async () => {
        try {
          const result = await item.taskFn();
          item.resolve(result);
        } catch (error) {
          item.reject(error);
        } finally {
          this.activeSessions.delete(sessionId);
          this.globalActiveCount--;
          // Trigger next evaluation
          this.processNext();
        }
      })();

      // Break loop if limits are hit
      if (
        this.globalActiveCount >= this.maxGlobalConcurrency ||
        this.activeSessions.size >= this.maxAgentConcurrency
      ) {
        break;
      }
    }
  }

  public getQueueLength(sessionId: string): number {
    return this.sessionQueues.get(sessionId)?.length || 0;
  }

  public getActiveSessionCount(): number {
    return this.activeSessions.size;
  }
}
