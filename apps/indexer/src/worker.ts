export type WorkerLoopOptions = {
  shouldRun: () => boolean;
  runOnce: () => Promise<void>;
  sleep: (milliseconds: number) => Promise<void>;
  intervalMs?: number;
  onError?: (error: unknown) => void;
};

/** Runs indexer cycles until shutdown is requested; failed cycles do not advance a checkpoint. */
export async function runWorkerLoop(options: WorkerLoopOptions): Promise<void> {
  const intervalMs = options.intervalMs ?? 4_000;
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 0) {
    throw new RangeError("Worker interval must be a non-negative integer");
  }

  while (options.shouldRun()) {
    try {
      await options.runOnce();
    } catch (error) {
      options.onError?.(error);
    }
    if (options.shouldRun()) await options.sleep(intervalMs);
  }
}
