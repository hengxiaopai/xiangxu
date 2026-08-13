import type { StoredOfflineCapture, OfflineCaptureStore } from "./offline-capture";

const DATABASE_NAME = "xiangxu-offline-v1";
const STORE_NAME = "capture-commands";

export class IndexedDbOfflineCaptureStore implements OfflineCaptureStore {
  async put(record: StoredOfflineCapture): Promise<void> {
    const database = await openDatabase();
    try {
      await transactionPromise(database, "readwrite", (store) => store.put(record, record.command.localId));
    } finally {
      database.close();
    }
  }

  async list(): Promise<readonly StoredOfflineCapture[]> {
    const database = await openDatabase();
    try {
      return await transactionPromise(database, "readonly", (store) => store.getAll());
    } finally {
      database.close();
    }
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (globalThis.indexedDB === undefined) throw new Error("Native IndexedDB is unavailable");
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionPromise<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}
