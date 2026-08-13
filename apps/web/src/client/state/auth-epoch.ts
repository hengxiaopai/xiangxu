import { v7 as uuidv7 } from "uuid";

import type { ClientAuthEpoch } from "./query-keys";

const AUTH_EPOCH_STORAGE_KEY = "xiangxu:client-auth-epoch:v1";
const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
let cachedBrowserEpoch: ClientAuthEpoch | undefined;

export function createClientAuthEpoch(): ClientAuthEpoch {
  return uuidv7() as ClientAuthEpoch;
}

export function establishClientSession(): ClientAuthEpoch {
  if (globalThis.window === undefined) return createClientAuthEpoch();
  if (cachedBrowserEpoch !== undefined) return cachedBrowserEpoch;
  try {
    const stored = globalThis.sessionStorage.getItem(AUTH_EPOCH_STORAGE_KEY);
    if (stored !== null && UUID_V7_PATTERN.test(stored)) {
      cachedBrowserEpoch = stored as ClientAuthEpoch;
      return cachedBrowserEpoch;
    }
  } catch {
    // Browser storage can be disabled; the in-memory epoch remains fail-closed for this page lifetime.
  }
  return rotateBrowserEpoch();
}

export function beginClientSession(): ClientAuthEpoch {
  return rotateBrowserEpoch();
}

export function retireClientSession(): ClientAuthEpoch {
  return rotateBrowserEpoch();
}

function rotateBrowserEpoch(): ClientAuthEpoch {
  const epoch = createClientAuthEpoch();
  if (globalThis.window === undefined) return epoch;
  cachedBrowserEpoch = epoch;
  try {
    globalThis.sessionStorage.setItem(AUTH_EPOCH_STORAGE_KEY, epoch);
  } catch {
    // The opaque epoch is still valid in memory; no server authority is stored client-side.
  }
  return epoch;
}
