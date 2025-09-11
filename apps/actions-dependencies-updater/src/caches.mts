import * as log from "./logger.mjs";
import { GithubShaToVersionCache } from "./github.mjs";
import { UpdateTransaction } from "./updater.mjs";
import { ActionsByIdentifier } from "./workflows.mjs";
import { isShaRefIdentifier } from "./utils.mjs";

import { join } from "node:path";

export function initialize(forceRefresh: boolean) {
  return {
    shaToVersion: new Cache<GithubShaToVersionCache>(
      true,
      "sha-to-version.json",
      forceRefresh,
    ),
    actionsByIdentifier: new Cache<ActionsByIdentifier>(
      true,
      "actions-by-identifier.json",
      forceRefresh,
    ),
    directActionsDependencies: new Cache<Record<string, boolean>>(
      false,
      "direct-actions-dependencies.json",
      true,
      {},
    ),
    updateTransactions: new Cache<UpdateTransaction>(
      false,
      `updates-transactions.json`,
      true,
      {},
    ),
  };
}

export function cleanup(caches: ReturnType<typeof initialize>) {
  // Clear part of the actionsByIdentifier cache before persisting
  // 1. Delete local actions as they could clash across repos with the same filenames (not unique)
  // 2. Delete any actions that are not sha references as the contents could change (ref not immutable)
  // 3. Delete actions with type unknown as they were not fully processed, and should no be cached.
  // 4. Clear reference paths as they could clash between checks in same or other repos
  const actionsByIdentifier = caches.actionsByIdentifier.get();
  Object.keys(actionsByIdentifier).forEach((key) => {
    const action = actionsByIdentifier[key];
    if (
      action.isLocal ||
      action.type === "unknown" ||
      !isShaRefIdentifier(action.identifier)
    ) {
      log.debug(`Clearing ${key} from cache`);
      return delete actionsByIdentifier[key];
    }
    actionsByIdentifier[key].referencePaths = [];
  });
}

export function persistAll(caches: ReturnType<typeof initialize>) {
  cleanup(caches);
  Object.values(caches).forEach((cache) => cache.save());
}

class Cache<T extends Record<string, any>> {
  static cacheDir = ".cache";

  private initializeFromDisk: boolean;
  private filePath: string;
  private cache: T;

  constructor(
    initializeFromDisk: boolean,
    fileName: string,
    forceRefresh: boolean,
    initial?: T,
  ) {
    this.filePath = join(Cache.cacheDir, fileName);
    this.initializeFromDisk = initializeFromDisk;

    if (initializeFromDisk && !forceRefresh) {
      this.cache = this.load();
    } else if (initial) {
      this.cache = initial;
    } else {
      this.cache = {} as T;
    }
  }

  public get(): T {
    return this.cache;
  }

  public set(key: keyof T, value: T[keyof T]) {
    this.cache[key] = value;
  }

  public getValue(key: keyof T): T[keyof T] {
    return this.cache[key];
  }

  public getValueOrDefault(key: keyof T, defaultValue: T[keyof T]): T[keyof T] {
    if (!this.exists(key)) {
      this.set(key, defaultValue);
    }
    return this.cache[key];
  }

  public exists(key: keyof T): boolean {
    return this.cache[key] !== undefined;
  }

  private load(): T {
    try {
      const cache = fs.readFileSync(this.filePath, "utf-8");
      return cache ? JSON.parse(cache) : {};
    } catch (e: any) {
      if (e.code === "ENOENT") {
        log.warn("No cache found - continuing without");
      } else {
        log.error(`Failed to load cache - continuing without: ${e}`);
      }
      return {} as T;
    }
  }

  public save() {
    if (!this.initializeFromDisk) return;

    try {
      const cache = JSON.stringify(this.cache, null, 2);
      fs.writeFileSync(this.filePath, cache, "utf-8");
    } catch (e) {
      log.error(`Failed to save cache: ${e}`);
    }
  }
}
