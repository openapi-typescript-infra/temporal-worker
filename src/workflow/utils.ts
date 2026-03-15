import type { Trigger } from '@temporalio/workflow';
import { ActivityFailure, log, sleep } from '@temporalio/workflow';

export const WAIT_COMPLETE = Symbol.for('@sesamecare/temporal-worker::WAIT_COMPLETE');

/**
 * Wait until a specific future time using Workflow primitives
 */
export async function waitUntilSpecificTime(targetTime: Date): Promise<void> {
  const currentTime = new Date();
  const delay = targetTime.getTime() - currentTime.getTime();

  if (delay > 0) {
    // Wait for the calculated delay duration
    await sleep(delay);
  }
}

/**
 * Wait until the a trigger resolves OR a specific future time using Workflow primitives (whichever comes first).
 * @returns The result of the trigger or WAIT_COMPLETE if the target time was reached first
 */
export async function waitUntilTriggerOrSpecificTime<T>(
  targetTime: Date,
  trigger: Trigger<T>,
): Promise<T | typeof WAIT_COMPLETE> {
  const currentTime = new Date();
  const delay = targetTime.getTime() - currentTime.getTime();

  if (delay > 0) {
    // Wait for the calculated delay duration or until a signal is received
    return Promise.race([
      sleep(delay).then(() => WAIT_COMPLETE) as Promise<typeof WAIT_COMPLETE>,
      trigger,
    ]);
  }
  return WAIT_COMPLETE;
}

/**
 * Our logging convention is metadata first, message second. This
 * just makes the Temporal workflow logger consistent
 */
export const workflowLog = {
  trace(attrOrMessage: Record<string, unknown> | string, message?: string) {
    if (typeof attrOrMessage === 'string') {
      log.trace(attrOrMessage);
    } else {
      log.trace(message as string, attrOrMessage);
    }
  },
  debug(attrOrMessage: Record<string, unknown> | string, message?: string) {
    if (typeof attrOrMessage === 'string') {
      log.debug(attrOrMessage);
    } else {
      log.debug(message as string, attrOrMessage);
    }
  },
  info(attrOrMessage: Record<string, unknown> | string, message?: string) {
    if (typeof attrOrMessage === 'string') {
      log.info(attrOrMessage);
    } else {
      log.info(message as string, attrOrMessage);
    }
  },
  warn(attrOrMessage: Record<string, unknown> | string, message?: string) {
    if (typeof attrOrMessage === 'string') {
      log.warn(attrOrMessage);
    } else {
      log.warn(message as string, attrOrMessage);
    }
  },
  error(attrOrMessage: Record<string, unknown> | string, message?: string) {
    if (typeof attrOrMessage === 'string') {
      log.error(attrOrMessage);
    } else {
      log.error(message as string, attrOrMessage);
    }
  },
};

export function isCancelError(e: unknown): e is ActivityFailure {
  return e instanceof ActivityFailure && (e.cause as { type?: string })?.type === 'CancelException';
}
