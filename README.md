# @openapi-typescript-infra/temporal-worker

A Typescript node module to centralize some boilerplate around creating Temporal.io workers. The module will wire up Temporal logging to @openapi-typescript-infra/service logging and take care of spin up and spin down as well as a default workflow code location.

## OpenTelemetry workflow tracing

Use `withOpenTelemetryWorkerOptions` to add Temporal's OpenTelemetry activity interceptor, workflow interceptor module, and optional workflow span exporter sink without overwriting app-specific worker options.

```typescript
import { Temporal, withOpenTelemetryWorkerOptions } from '@openapi-typescript-infra/temporal-worker';

await temporal.start(
  withOpenTelemetryWorkerOptions(
    {
      ...temporalConfig,
      taskQueue: temporalConfig.taskQueue ?? 'my-service',
    },
    {
      spanProcessor,
      resource,
    },
  ),
  activities,
);
```

If the app already has `interceptors.activity`, `interceptors.workflowModules`, or `sinks`, the helper preserves them and appends the Temporal OpenTelemetry wiring.
