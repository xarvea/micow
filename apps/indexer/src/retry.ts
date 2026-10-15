export type RpcRetryOptions = {
  attempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  onRetry?: (error: unknown, failedAttempt: number) => void;
};

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function withRpcRetry<T>(
  operation: () => Promise<T>,
  options: RpcRetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 4_000;
  const wait = options.sleep ?? sleep;

  if (!Number.isSafeInteger(attempts) || attempts < 1) {
    throw new RangeError("RPC retry attempts must be a positive integer");
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      options.onRetry?.(error, attempt);
      const delay = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs);
      await wait(delay);
    }
  }

  throw lastError;
}
