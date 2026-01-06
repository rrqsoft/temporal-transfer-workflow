import { CancellationScope, proxyActivities } from '@temporalio/workflow';
import { CancelledFailure } from '@temporalio/common';
import * as activities from './01_activities';

const { parent } = proxyActivities<typeof activities>({
  retry: {
    initialInterval: '1 second',
    maximumInterval: '1 minute',
    backoffCoefficient: 2,
    maximumAttempts: 1,
  },
  startToCloseTimeout: '1 minute',
});
export async function deepOperations(): Promise<number> {
  const scope = new CancellationScope({ cancellable: false, timeout: 3000 });
  const task1 = scope.run(() => parent());

  try {
    scope.cancel();
    await Promise.allSettled([task1, scope.cancelRequested]);
  } catch (e) {
    if (e instanceof CancelledFailure) {
      console.log('RRR', e.name, e.message);
    }
    throw e;
  }

  return 1;
}
