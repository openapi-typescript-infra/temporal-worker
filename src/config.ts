import type { WorkerOptions } from '@temporalio/worker';

export interface TemporalWorkerConfig extends WorkerOptions {
  // Defaults to true, so enabled unless false
  clientEnabled?: boolean;

  // Defaults to false, so disabled unless true
  workerEnabled?: boolean;

  // The host:port of the Temporal cluster
  address: string;

  // The namespace to connect to
  namespace?: string;

  // Typia has a problem validating Buffers, so we need to
  // "retype" them as Uint8Array
  tls?: {
    clientCertPair: {
      key: Uint8Array;
      crt: Uint8Array;
    };
  };
}
