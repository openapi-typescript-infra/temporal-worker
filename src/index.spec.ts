import { describe, expect, test } from 'vitest';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { ActivityFailure, ApplicationFailure } from '@temporalio/common';
import type { ServiceExpress } from '@openapi-typescript-infra/service';

import { Temporal } from './index.js';
import { combineActivities } from './createActivities.js';
import { isCancelError, WAIT_COMPLETE } from './workflow/utils.js';

const fakeApp = {
  locals: {
    logger: {
      isLevelEnabled() {
        return true;
      },
      level: 'warn',
      fatal() {},
      silent() {},
      ...console,
    },
  },
} as unknown as ServiceExpress;

describe('Module exports', () => {
  test('should export expected elements', async () => {
    expect(Temporal).to.be.a('function');
    const temporal = new Temporal(fakeApp);
    expect(temporal).toBeTruthy();
    expect(temporal.start).to.be.a('function');
    await expect(temporal.stop()).resolves.not.toThrow();
  });

  test('should run a simple workflow', async () => {
    const env = await TestWorkflowEnvironment.createLocal();
    const temporal = new Temporal(fakeApp);
    temporal.setClientConnection(env.connection);
  });
});

describe('Workflow helpers', () => {
  test('WAIT_COMPLETE is a unique symbol', () => {
    expect(typeof WAIT_COMPLETE).toBe('symbol');
    expect(WAIT_COMPLETE).toBe(Symbol.for('@sesamecare/temporal-worker::WAIT_COMPLETE'));
  });

  test('isCancelError identifies cancellation errors', () => {
    const cancelError = new ActivityFailure(
      'cancelled',
      undefined,
      0,
      'test',
      'test',
      new ApplicationFailure('cancel', 'CancelException'),
    );
    // Force the cause type to match what isCancelError checks
    (cancelError.cause as { type?: string }).type = 'CancelException';
    expect(isCancelError(cancelError)).toBe(true);
  });

  test('isCancelError rejects non-cancel errors', () => {
    expect(isCancelError(new Error('not a cancel'))).toBe(false);
    expect(isCancelError(null)).toBe(false);
    expect(isCancelError(undefined)).toBe(false);
  });

  test('combineActivities merges activity maps', () => {
    const a = { foo: () => 1 };
    const b = { bar: () => 2 };
    const combined = combineActivities(a, b);
    expect(combined.foo()).toBe(1);
    expect(combined.bar()).toBe(2);
  });

  test('combineActivities throws on duplicate names', () => {
    const a = { foo: () => 1 };
    const b = { foo: () => 2 };
    expect(() => combineActivities(a, b)).toThrow('Duplicate activity names: foo');
  });
});
