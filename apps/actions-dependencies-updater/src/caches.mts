import * as log from "./logger.mjs";
import { GithubShaToVersionCache } from "./github.mjs";
import { UpdateTransaction } from "./updater.mjs";

import { join } from "node:path";

const SHA_TO_VERSION_CACHE = "sha-to-version.json";

export function initialize(forceRefresh: boolean, id = Date.now()) {
  const cachePath = join(Cache.cacheDir, SHA_TO_VERSION_CACHE)
  const cacheExists = fs.existsSync(cachePath);

  if (cacheExists && forceRefresh) {
    try {
      log.warn(
        `Forcing cache refresh. Deleting ${cachePath} and creating a new cache file`,
      );
      fs.rmSync(cachePath);
    } catch (e) {
      log.error(`Failed to delete cache: ${e}`);
    }
  }

  return {
    shaToVersion: new Cache<GithubShaToVersionCache>(
      true,
      SHA_TO_VERSION_CACHE,
    ),
    updateTransactions: new Cache<UpdateTransaction>(
      false,
      `updates-${id}.json`,
      {},
    ),
  };
}

class Cache<T extends Record<string, any>> {
  static cacheDir = ".cache";

  private initializeFromDisk: boolean;
  private filePath: string;
  private cache: T;

  constructor(initializeFromDisk: boolean, fileName: string, initial?: T) {
    this.filePath = join(Cache.cacheDir, fileName);
    this.initializeFromDisk = initializeFromDisk;

    if (initializeFromDisk) {
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
