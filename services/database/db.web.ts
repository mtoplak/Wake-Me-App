type WebDbResult = {
  lastInsertRowId: number;
  changes: number;
};

type WebDb = {
  runAsync: (sql: string, params?: unknown[]) => Promise<WebDbResult>;
  getAllAsync: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  getFirstAsync: <T>(sql: string, params?: unknown[]) => Promise<T | null>;
  execAsync: (sql: string) => Promise<void>;
};

let dbInstance: WebDb | null = null;
let initPromise: Promise<WebDb> | null = null;
let lastInsertRowId = 0;

export async function getDb(): Promise<WebDb> {
  if (dbInstance) return dbInstance;
  if (!initPromise) initPromise = openAndInit();
  dbInstance = await initPromise;
  return dbInstance;
}

async function openAndInit(): Promise<WebDb> {
  return {
    async runAsync() {
      lastInsertRowId += 1;
      return { lastInsertRowId, changes: 1 };
    },
    async getAllAsync<T>() {
      return [] as T[];
    },
    async getFirstAsync<T>() {
      return null as T | null;
    },
    async execAsync() {
      return;
    },
  };
}

export async function resetDb(): Promise<void> {
  await getDb();
  lastInsertRowId = 0;
}