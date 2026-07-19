export type BoundedSourceState = "hit" | "miss" | "timeout" | "error";

export interface BoundedSourceTiming {
  source: string;
  elapsedMs: number;
  state: BoundedSourceState;
}

export interface BoundedSourceResult<T> {
  value: T | null;
  timing: BoundedSourceTiming;
}

/**
 * Runs one best-effort account lookup without letting it hold the first plan
 * hostage. HTTP sources receive an AbortSignal; non-abortable work such as a
 * database query is still bounded by the race and may finish in the background.
 */
export async function runBoundedSource<T>(
  source: string,
  timeoutMs: number,
  load: (signal: AbortSignal) => Promise<T | null>
): Promise<BoundedSourceResult<T>> {
  const startedAt = performance.now();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const work: Promise<BoundedSourceResult<T>> = Promise.resolve()
    .then(() => load(controller.signal))
    .then((value): BoundedSourceResult<T> => ({
        value,
        timing: {
          source,
          elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
          state: value === null ? "miss" : "hit"
        }
      }))
    .catch((): BoundedSourceResult<T> => ({
        value: null,
        timing: {
          source,
          elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
          state: "error"
        }
      }));

  const timeout = new Promise<BoundedSourceResult<T>>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({
        value: null,
        timing: {
          source,
          elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
          state: "timeout"
        }
      });
    }, timeoutMs);
  });

  const result = await Promise.race([work, timeout]);
  if (timer) clearTimeout(timer);
  return result;
}
