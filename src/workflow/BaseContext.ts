import { log, upsertSearchAttributes } from '@temporalio/workflow';

import { isCancelError, workflowLog } from './utils.js';

type BaseContext = object;

/**
 * BE CAREFUL! If you modify the logic here you may cause an NDE for existing workflows.
 * Use patched() to guard new operations.
 */
export abstract class BaseWorkflowContext<SpecificContext extends BaseContext> {
  didCancel = false;
  stage = 'start';
  waitingUntil?: string;

  constructor(protected context: SpecificContext) {}

  /**
   * Run any cancellation activities.
   */
  abstract cancel(): Promise<void>;

  setProgress(stage: string, until?: string) {
    if (until) {
      workflowLog.info({ until, stage }, 'Sleeping');
    } else {
      workflowLog.debug({ stage }, 'Progress');
    }
    this.stage = stage;
    upsertSearchAttributes({ CurrentStage: [this.stage] });
    this.waitingUntil = until;
  }

  async endWorkflow() {
    log.info('The workflow will terminate');
    if (this.didCancel) {
      this.setProgress('cancel');
      await this.cancel();
      return { outcome: 'canceled' };
    }

    this.setProgress('ending');
    return { outcome: 'completed' };
  }

  handleCancelOrThrow(e: unknown) {
    if (isCancelError(e)) {
      // This allows the activity exceptions to do what the signal would have done
      // without having direct access to the workflow context.
      this.didCancel = true;
      workflowLog.info('Cancellation signal received');
    } else {
      throw e;
    }
  }
}
