export interface SyncWatchPlayer {
  syncedAt: string;
}

export interface PluginSyncWatchOptions<T extends SyncWatchPlayer> {
  read: () => Promise<T | null>;
  initialSyncedAt: string | null;
  timeoutMs?: number;
  intervalMs?: number;
  signal?: AbortSignal;
  now?: () => number;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    const abort = () => {
      clearTimeout(timer);
      finish();
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

/** Waits for the first accepted scan or a scan newer than the one on screen. */
export async function waitForAcceptedPluginSync<T extends SyncWatchPlayer>(
  options: PluginSyncWatchOptions<T>
): Promise<T | null> {
  const timeoutMs = Math.max(0, options.timeoutMs ?? 15_000);
  const intervalMs = Math.max(25, options.intervalMs ?? 1_500);
  const now = options.now ?? Date.now;
  const deadline = now() + timeoutMs;

  while (!options.signal?.aborted && now() < deadline) {
    await wait(Math.min(intervalMs, Math.max(0, deadline - now())), options.signal);
    if (options.signal?.aborted) return null;
    const player = await options.read().catch(() => null);
    if (player && (options.initialSyncedAt === null || player.syncedAt !== options.initialSyncedAt)) {
      return player;
    }
  }
  return null;
}
