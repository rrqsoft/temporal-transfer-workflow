import {
  log,
  proxyActivities,
  setHandler,
  CancellationScope,
  isCancellation,
  CancelledFailure,
} from '@temporalio/workflow';
import * as activities from './activities';
import { abortSignal } from './signals';
import { queryAborted } from './queries';

const { checkStatus, writeRecord, randomSuccess } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 1,
    nonRetryableErrorTypes: ['CancelledFailure'], // for explicit abort query (race condition mitigation)
  },
});

const { _mockAdditionalActivities } = proxyActivities<typeof activities>({
  startToCloseTimeout: '32 seconds',
  retry: {
    maximumAttempts: 2,
    backoffCoefficient: 2,
    nonRetryableErrorTypes: ['CancelledFailure'], // for explicit abort query (race condition mitigation)
  },
  heartbeatTimeout: '2 seconds',
});

const { revertRecord } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 1,
  },
  heartbeatTimeout: '2 seconds',
});

const {
  cleanUpScheduleWhenDone,
  unpauseQueryStatusSchedule,
  deleteReferenceSchedule,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 1,
  },
  heartbeatTimeout: '2 seconds',
});

interface ICompensation {
  message?: string;
  fn: () => Promise<void>;
}

interface IQueryOptions {
  isManual?: boolean;
  referenceId: string;
}

export async function query(arg: string, options: IQueryOptions) {
  const compensations: ICompensation[] = []; // saga pattern
  const scope = new CancellationScope({ cancellable: true });
  const currentScope = CancellationScope.current();
  const externalCancelRequested = currentScope.cancelRequested;

  setHandler(abortSignal, () => {
    log.info('Aborting query');
    scope.cancel();
  });

  setHandler(queryAborted, () => {
    log.info('Query task');
    return {
      compensations,
    };
  });

  try {
    const checkStatusTask = scope.run(() => checkStatus(arg));
    await Promise.race([checkStatusTask, currentScope.cancelRequested]);
  } catch (e) {
    log.error('Error in checking status', { error: e });
    throw e;
  }

  let success = false;
  try {
    const writeRecordTask = scope.run(() => writeRecord(arg));
    await Promise.race([writeRecordTask, currentScope.cancelRequested]);

    compensations.unshift({
      // compensate on error since record is written
      fn: async () => revertRecord(arg), // or compensation transaction instead of deleting the record
      message: 'Revert record',
    });

    // Other Activities
    const otherActivitiesTask = scope.run(() =>
      // simulate delay (while record is written)
      _mockAdditionalActivities(8500)
    );
    await Promise.race([otherActivitiesTask, currentScope.cancelRequested]);

    // delete schedule
    const successTask = scope.run(() => randomSuccess());
    const res = await Promise.race([successTask, currentScope.cancelRequested]);
    success = typeof res === 'boolean' ? res : false;
    const deleteWhenOptions = {
      success,
    };
    const cleanUpTask = scope.run(() =>
      cleanUpScheduleWhenDone(
        options.isManual ? options.referenceId : arg,
        deleteWhenOptions
      )
    );
    await Promise.race([cleanUpTask, currentScope.cancelRequested]);
  } catch (e) {
    if (isCancellation(e) || e instanceof CancelledFailure) {
      await CancellationScope.nonCancellable(() => compensate(compensations));

      if (e instanceof CancelledFailure) {
        // overlap policy error or Temporal Service root scope cancellation
        log.info('CancelledFailure', { error: e });
      }
    } else {
      log.error('Workflow failed', { error: e });
      throw e;
    }
  } finally {
    const isValidManualOperation = options.isManual && options.referenceId;
    if (isValidManualOperation && !success) {
      await CancellationScope.nonCancellable(() =>
        unpauseQueryStatusSchedule(options.referenceId)
      );
    }

    // graceful cleanup
    if (isValidManualOperation && success) {
      await CancellationScope.nonCancellable(() =>
        deleteReferenceSchedule(options.referenceId)
      );
    }
  }

  return {
    success,
  };
}

async function compensate(compensations: ICompensation[]) {
  // do compensations here
  for (const compensation of compensations) {
    try {
      log.info('Compensating', { compensation: compensation.message });
      await compensation.fn();
    } catch (e) {
      log.error('Error in compensating', { error: e });
    }
  }
}
