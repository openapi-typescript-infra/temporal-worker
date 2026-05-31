import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  makeWorkflowExporter,
  OpenTelemetryActivityInboundInterceptor,
} from '@temporalio/interceptors-opentelemetry';
import type { InjectedSinks, WorkerInterceptors, WorkerOptions } from '@temporalio/worker';
import type { Sinks } from 'node_modules/@temporalio/workflow/lib';

function resolveOpenTelemetryWorkflowInterceptorModule() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const builtModule = path.join(moduleDir, 'workflow/opentelemetry.js');
  return existsSync(builtModule) ? builtModule : path.join(moduleDir, 'workflow/opentelemetry.ts');
}

export const OPEN_TELEMETRY_WORKFLOW_INTERCEPTOR_MODULE =
  resolveOpenTelemetryWorkflowInterceptorModule();

export interface OpenTelemetryWorkerOptions {
  /**
   * Enables workflow-sandbox span export. Activity spans and workflow headers
   * are still configured when omitted. Deliberately structural: apps should be
   * able to pass the SpanProcessor/Resource objects from their service-level
   * OpenTelemetry setup without depending on the exact OTel versions used by
   * @temporalio/interceptors-opentelemetry.
   */
  spanProcessor?: object;
  resource?: object;
  workflowInterceptorModule?: string;
}

function appendOpenTelemetryInterceptors(
  interceptors: WorkerInterceptors | undefined,
  workflowInterceptorModule: string,
): WorkerInterceptors {
  return {
    ...interceptors,
    activity: [
      ...(interceptors?.activity ?? []),
      (ctx) => ({ inbound: new OpenTelemetryActivityInboundInterceptor(ctx) }),
    ],
    workflowModules: [...(interceptors?.workflowModules ?? []), workflowInterceptorModule],
  };
}

/**
 * Adds Temporal OpenTelemetry interceptors to worker options while preserving
 * any app-provided interceptors and sinks.
 */
export function withOpenTelemetryWorkerOptions<T extends WorkerOptions>(
  workerOptions: T,
  options: OpenTelemetryWorkerOptions = {},
): T {
  const workflowInterceptorModule =
    options.workflowInterceptorModule ?? OPEN_TELEMETRY_WORKFLOW_INTERCEPTOR_MODULE;

  const nextOptions: WorkerOptions = {
    ...workerOptions,
    interceptors: appendOpenTelemetryInterceptors(
      workerOptions.interceptors,
      workflowInterceptorModule,
    ),
  };

  if (options.spanProcessor && options.resource) {
    nextOptions.sinks = {
      ...(workerOptions.sinks as InjectedSinks<Sinks> | undefined),
      exporter: makeWorkflowExporter(
        options.spanProcessor as Parameters<typeof makeWorkflowExporter>[0],
        options.resource as Parameters<typeof makeWorkflowExporter>[1],
      ),
    };
  }

  return nextOptions as T;
}
