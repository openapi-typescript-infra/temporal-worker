import path from 'path';

import type { ConnectionLike, TLSConfig } from '@temporalio/client';
import { Client, Connection } from '@temporalio/client';
import type { LogLevel, Logger, WorkerOptions } from '@temporalio/worker';
import { NativeConnection, Runtime, Worker, makeTelemetryFilterString } from '@temporalio/worker';
import type { ServiceExpress } from '@openapi-typescript-infra/service';
import { getNodeEnv } from '@openapi-typescript-infra/service';

import type { TemporalWorkerConfig } from './config.js';

let runtimeInstalled = false;

function init(app: ServiceExpress) {
  if (!runtimeInstalled) {
    const { logger } = app.locals;
    const temporalLogger: Logger = {
      trace(message, meta) {
        logger.trace(meta, message);
      },
      debug(message, meta) {
        logger.debug(meta, message);
      },
      info(message, meta) {
        logger.info(meta, message);
      },
      warn(message, meta) {
        logger.warn(meta, message);
      },
      error(message, meta) {
        logger.error(meta, message);
      },
      log(level, message, meta) {
        const l = level.toLowerCase();
        if (['trace', 'debug', 'info', 'warn', 'error'].includes(l)) {
          logger[l as 'trace' | 'debug' | 'info' | 'warn' | 'error'](meta, message);
        } else {
          logger.warn({ originalLevel: l, originalMessage: message }, 'Unknown log level');
        }
      },
    };
    const logLevel =
      (process.env.TEMPORAL_LOG_LEVEL as LogLevel) ||
      (getNodeEnv() === 'development' ? 'INFO' : 'WARN');
    Runtime.install({
      logger: temporalLogger,
      shutdownSignals: [],
      telemetryOptions: {
        metrics: {
          prometheus: { bindAddress: '0.0.0.0:9464' },
        },
        logging: {
          filter: makeTelemetryFilterString({
            core: logLevel,
            other: logLevel,
          }),
          forward: {},
        },
      },
    });
    runtimeInstalled = true;
  }
}

export class Temporal {
  private namespace: string | undefined;
  private worker?: Worker;
  private workerPromise: Promise<void> | undefined;
  private connection?: NativeConnection;
  private _client?: Client;

  constructor(private app: ServiceExpress) {}

  get client() {
    if (!this._client) {
      throw new Error('Temporal not connected');
    }
    return this._client;
  }

  async start(
    config: TemporalWorkerConfig,
    activities: WorkerOptions['activities'],
    workflowsPath?: string,
  ) {
    const { address, tls, clientEnabled, namespace, workerEnabled, ...workerConfig } = config;
    this.namespace = namespace;

    if (clientEnabled === false && !workerEnabled) {
      // No point in doing anything
      return;
    }

    init(this.app);

    if (clientEnabled !== false) {
      const connection = Connection.lazy({ address, tls: tls as TLSConfig });
      this._client = new Client({ connection, namespace });
      this.app.locals.logger.info({ namespace }, 'Started Temporal client');
    }

    if (!workerEnabled) {
      return;
    }

    this.connection = await NativeConnection.connect({
      address,
      tls: tls as TLSConfig,
    });
    this.worker = await Worker.create({
      connection: this.connection,
      namespace,
      activities,
      workflowsPath: workflowsPath || path.resolve('src/temporal/workflows'),
      ...workerConfig,
    });

    this.workerPromise = this.worker.run().catch((error) => {
      this.app.locals.logger.warn(error, 'Temporal worker failed, shutting down');
      const stopPromise = this.app.locals.service.stop?.(this.app);
      if (stopPromise) {
        stopPromise.catch((stopError) => {
          // eslint-disable-next-line no-console
          console.error('Failed to stop the app', stopError);
        });
      }
    });
    this.app.locals.logger.info('Started Temporal worker');
  }

  async stop() {
    try {
      if (this.worker) {
        this.worker.shutdown();
        await this.workerPromise;
        await this.connection?.close();
        delete this.worker;
        delete this.connection;
        delete this.workerPromise;
      }

      if (this._client) {
        await this._client.connection.close();
        delete this._client;
      }

      if (runtimeInstalled) {
        await Runtime.instance().shutdown();
        runtimeInstalled = false;
      }
    } catch (error) {
      this.app.locals.logger.warn(error, 'Failed to stop Temporal');
    }
  }

  setClientConnection(connection: ConnectionLike) {
    this._client = new Client({ connection, namespace: this.namespace });
  }

  setWorker(worker: Worker) {
    this.worker = worker;
  }
}
