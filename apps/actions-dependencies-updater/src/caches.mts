import * as log from "./logger.mjs";
import { GithubShaToVersionCache } from "./github.mjs";
import { UpdateTransaction } from "./updater.mjs";

import { join } from "node:path";

export function initialize(forceRefresh: boolean) {
  return {
    shaToVersion: new Cache<GithubShaToVersionCache>(
      true,
      "sha-to-version.json",
      forceRefresh,
    ),
    updateTransactions: new Cache<UpdateTransaction>(
      false,
      `updates-transactions.json`,
      true,
      {},
    ),
  };
}

class Cache<T extends Record<string, any>> {
  static cacheDir = ".cache";

  private initializeFromDisk: boolean;
  private filePath: string;
  private cache: T;

  constructor(initializeFromDisk: boolean, fileName: string, forceRefresh: boolean, initial?: T) {
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
