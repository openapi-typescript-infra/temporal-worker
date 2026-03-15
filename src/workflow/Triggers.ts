import { sleep, Trigger } from '@temporalio/workflow';

import { WAIT_COMPLETE } from './utils.js';

/**
 * This class makes it easier to manage a set of signals that can be awaited on.
 */
export class Triggers<T extends Record<keyof T, object>> {
  private triggers: Partial<{ [K in keyof T]: Trigger<T[K]> }> = {};

  async withTrigger<K extends keyof T, R>(
    key: K,
    fn: (trigger: Trigger<T[K]>) => Promise<T[K] | R>,
  ): Promise<T[K] | R> {
    this.triggers[key] = this.triggers[key] ?? new Trigger();
    try {
      return await fn(this.triggers[key]);
    } finally {
      delete this.triggers[key];
    }
  }

  async waitFor<K extends keyof T>(key: K) {
    if (!this.triggers[key]) {
      this.triggers[key] = new Trigger();
    }
    const trigger = this.triggers[key] as Trigger<T[K]>;
    try {
      return await trigger;
    } finally {
      delete this.triggers[key];
    }
  }

  async waitForFirst<K extends keyof T>(...keys: K[]): Promise<[K, T[K]]> {
    const promises = keys.map(async (key) => {
      if (!this.triggers[key]) {
        this.triggers[key] = new Trigger<T[K]>();
      }

      const result = await (this.triggers[key] as Trigger<T[K]>);
      return [key, result] as [K, T[K]];
    });

    const firstResolved = await Promise.race(promises);

    // Clean up all triggers after the first one resolves
    for (const key of keys) {
      delete this.triggers[key];
    }

    return firstResolved;
  }

  async waitUntilTriggersOrSpecificTime<K extends keyof T>(
    targetTime: Date,
    ...keys: K[]
  ): Promise<T[K] | typeof WAIT_COMPLETE> {
    const currentTime = new Date();
    const delay = targetTime.getTime() - currentTime.getTime();

    if (delay > 0) {
      const triggerPromises = keys.map((key) => {
        if (!this.triggers[key]) {
          this.triggers[key] = new Trigger<T[K]>();
        }
        return this.triggers[key] as unknown as Promise<T[K]>;
      });

      // We can't use waitForFirst here because if the sleep wins, that would end
      // up resetting all the triggers when it resolved, even if we've moved on from it.
      const result = await Promise.race([
        sleep(delay).then(() => WAIT_COMPLETE) as Promise<typeof WAIT_COMPLETE>,
        ...triggerPromises,
      ]);

      // Clean up all triggers after the first one resolves
      for (const key of keys) {
        delete this.triggers[key];
      }

      return result;
    }

    return WAIT_COMPLETE;
  }

  resolve<K extends keyof T>(key: K, value: T[K]) {
    if (!this.triggers[key]) {
      this.triggers[key] = new Trigger<T[K]>();
    }
    this.triggers[key].resolve(value);
  }

  reject<K extends keyof T>(key: K, error: unknown) {
    if (!this.triggers[key]) {
      this.triggers[key] = new Trigger<T[K]>();
    }
    this.triggers[key].reject(error);
  }
}
