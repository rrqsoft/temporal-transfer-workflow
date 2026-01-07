import { Worker } from '@temporalio/worker';
import { namespace } from '../shared';
import * as schedulesActivities from './activities';

async function schedulers() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    activities: schedulesActivities,
    namespace,
    taskQueue: 'schedulers',
    // reuseV8Context: true,
  });

  await worker.run();
}

async function statusManualOperations() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    activities: schedulesActivities,
    namespace,
    taskQueue: 'status-manual-operations',
  });
  await worker.run();
}

schedulers().catch((err) => {
  console.error(err);
  process.exit(1);
});

statusManualOperations().catch((err) => {
  console.error(err);
  process.exit(1);
});
