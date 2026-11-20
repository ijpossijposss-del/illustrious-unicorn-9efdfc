let flushHandler: (() => Promise<void>) | null = null;

export function registerFlushHandler(handler: () => Promise<void>) {
  flushHandler = handler;
}

export function enqueueSync(_type?: string, _payload?: unknown) {
  return undefined;
}

export async function flush() {
  await flushHandler?.();
}

export default { enqueueSync, flush, registerFlushHandler };
