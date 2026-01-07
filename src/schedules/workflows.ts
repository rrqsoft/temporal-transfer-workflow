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

const { checkStatus, writeRecord } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 2,
    backoffCoefficient: 2, //exponential backoff mechanism,
    nonRetryableErrorTypes: ['CancelledFailure'], // for explicit abort query (race condition mitigation)
  },
  heartbeatTimeout: '2 seconds',
});

const { _mockAdditionalActivities } = proxyActivities<typeof activities>({
  startToCloseTimeout: '32 seconds',
  retry: {
    maximumAttempts: 1,
    nonRetryableErrorTypes: ['CancelledFailure'], // for explicit abort query (race condition mitigation)
  },
  heartbeatTimeout: '2 seconds',
});

const { revertRecord, cleanUpScheduleWhenDone } = proxyActivities<
  typeof activities
>({
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

  externalCancelRequested.catch(() => {
    scope.cancel();
  });

  try {
    await scope.run(() => checkStatus(arg));
  } catch (e) {
    log.error('Error in checking status', { error: e });
    throw e;
  }

  try {
    await scope.run(() => writeRecord(arg));

    compensations.push({
      // compensate on error since record is written
      fn: async () => revertRecord(arg), // or compensation transaction instead of deleting the record
      message: 'Revert record',
    });

    // Other Activities
    await scope.run(() =>
      // simulate delay (while record is written)
      _mockAdditionalActivities(30000)
    );

    // delete schedule
    const deleteWhenOptions = {
      maxActions: 3,
      isManual: options.isManual ?? false,
    };
    await scope.run(() => cleanUpScheduleWhenDone(arg, deleteWhenOptions));
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
  }

  return {
    success: true,
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
