// Thin wrapper around chrome.runtime.sendMessage for talking to the Crate
// Digger extension from the dashboard. Uses externally_connectable messaging,
// so the web page can reach the extension's service worker directly.

type ChromeRuntime = {
  runtime?: {
    sendMessage: (
      extensionId: string,
      message: unknown,
      callback: (response?: unknown) => void
    ) => void;
    lastError?: { message?: string };
  };
};

function getChrome(): ChromeRuntime['runtime'] | null {
  const c = (globalThis as unknown as { chrome?: ChromeRuntime }).chrome;
  return c?.runtime ?? null;
}

export function isExtensionApiAvailable(): boolean {
  return !!getChrome();
}

function send<T = unknown>(
  extensionId: string,
  message: unknown,
  timeoutMs = 1500
): Promise<T> {
  return new Promise((resolve, reject) => {
    const runtime = getChrome();
    if (!runtime || !extensionId) {
      reject(new Error('Extension not available'));
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Extension did not respond'));
      }
    }, timeoutMs);

    try {
      runtime.sendMessage(extensionId, message, (response?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (runtime.lastError) {
          reject(new Error(runtime.lastError.message ?? 'Extension error'));
          return;
        }
        resolve(response as T);
      });
    } catch (e) {
      clearTimeout(timer);
      reject(e instanceof Error ? e : new Error('Extension error'));
    }
  });
}

export type PingResult = {
  ok: boolean;
  paired: boolean;
  email?: string;
};

export async function pingExtension(extensionId: string): Promise<PingResult> {
  try {
    const res = await send<{ ok?: boolean; paired?: boolean; email?: string }>(
      extensionId,
      { type: 'ping' }
    );
    return {
      ok: !!res?.ok,
      paired: !!res?.paired,
      email: res?.email,
    };
  } catch {
    return { ok: false, paired: false };
  }
}

export async function pairExtension(
  extensionId: string,
  accessToken: string,
  refreshToken: string
): Promise<boolean> {
  const res = await send<{ ok?: boolean }>(extensionId, {
    type: 'pair',
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return !!res?.ok;
}

export async function startQueueInExtension(
  extensionId: string,
  sessionId: string
): Promise<boolean> {
  const res = await send<{ ok?: boolean }>(extensionId, {
    type: 'startSession',
    sessionId,
  });
  return !!res?.ok;
}
