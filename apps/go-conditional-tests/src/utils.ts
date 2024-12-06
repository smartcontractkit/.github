import * as core from "@actions/core";

export function insertWithoutDuplicates<K extends string, V>(
  key: K,
  value: V,
  obj: Record<string, V>,
): Record<string, V> {
  if (key in obj) {
    core.setFailed(`Duplicate key found: ${key}`);
    return obj;
  }
  obj[key] = value;
  return obj;
}

export async function executeConcurrentTasks<TItem, TResult>(
  items: TItem[],
  taskFn: (item: TItem) => Promise<TResult>,
  getItemKey: (item: TItem) => string,
  getResultKey: (result: TResult) => string,
  maxConcurrency: number,
): Promise<TResult[]> {
  const seen = new Set<string>();
  const finished: TResult[] = [];
  const executing = new Map<string, Promise<TResult>>();

  for (const item of items) {
    const key = getItemKey(item);

    if (seen.has(key)) {
      console.warn(`Duplicate item found: ${key}`);
      continue; // Skip adding the duplicate task
    }
    seen.add(key);

    const taskPromise = taskFn(item);
    executing.set(key, taskPromise);

    if (executing.size >= maxConcurrency) {
      const executingPromises = Array.from(executing.values());
      const finishedTask = await Promise.race(executingPromises);
      finished.push(finishedTask);

      const resultKey = getResultKey(finishedTask);
      if (!executing.has(resultKey)) {
        console.warn("Task not found in executing list");
        continue;
      }

      console.debug(`Finished Task: ${resultKey}`);
      executing.delete(resultKey);
    }
  }

  // Wait for all remaining tasks to complete
  const remainingResults = await Promise.all(executing.values());
  return [...finished, ...remainingResults];
}
