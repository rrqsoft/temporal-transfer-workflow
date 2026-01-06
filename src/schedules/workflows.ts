import {
  log,
  proxyActivities,
  setHandler,
  CancellationScope,
  isCancellation,
} from '@temporalio/workflow';
import * as activities from './activities';
import { abortSignal } from './signals';
import { queryAborted } from './queries';

const { checkStatus, writeRecord } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 2,
    backoffCoefficient: 2, //exponential backoff mechanism
  },
  heartbeatTimeout: '2 seconds',
});

const { revertRecord, _mockAdditionalActivities } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 1,
    nonRetryableErrorTypes: ['CancelledFailure'], // for explicit abort query (race condition mitigation)
  },
  heartbeatTimeout: '45 seconds',
});

const { deleteQueryStatusSchedules } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 1,
  },
});

interface ICompensation {
  message?: string;
  fn: () => Promise<void>;
}

export async function query(arg: string, isManual = false) {
  const compensations: ICompensation[] = []; // saga pattern
  const scope = new CancellationScope({ cancellable: true });

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
    await scope.run(() => checkStatus(arg));
  } catch (e) {
    log.error('Error in checking status', { error: e });
    throw e;
  }

  try {
    await scope.run(async () => writeRecord(arg));

    compensations.push({
      // compensate on error since record is written
      fn: async () => revertRecord(arg), // or compensation transaction instead of deleting the record
      message: 'Revert record',
    });

    // Other Activities
    await scope.run(() => _mockAdditionalActivities(3000)); // simulate delay (while record is written)

    // delete schedule
    const deleteWhenOptions = { maxActions: 3, isManual };
    await scope.run(() => deleteQueryStatusSchedules(arg, deleteWhenOptions));
  } catch (e) {
    await compensate(compensations);
    if (isCancellation(e)) {
      log.info('Manual cancel submission');
      // expected cancel
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
