/**
 * Keeps finished drawings on the iPad until they've uploaded,
 * so patchy venue wifi or an accidental reload never loses a portrait.
 */
export type Stashed = {
  id: string;
  photo: Blob;
  timelapse?: Blob;
  sitterName?: string;
  createdAt: number;
};

const DB = "solanafaces-booth";
const STORE = "pending";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const stash = {
  put: (item: Stashed) => run("readwrite", (s) => s.put(item)),
  remove: (id: string) => run("readwrite", (s) => s.delete(id)),
  all: () => run<Stashed[]>("readonly", (s) => s.getAll() as IDBRequest<Stashed[]>),
};
