// @@@SNIPSTART money-transfer-project-template-ts-worker
import { Worker } from '@temporalio/worker';
// import * as activities from './activities';
import * as activities from './examples/01_activities';
import { namespace, taskQueueName, deepTaskQueueName } from './shared';

// async function run() {
//   // Register Workflows and Activities with the Worker and connect to
//   // the Temporal server.
//   const worker = await Worker.create({
//     workflowsPath: require.resolve('./workflows'),
//     activities,
//     namespace,
//     taskQueue: taskQueueName,
//     // reuseV8Context: true,
//   });

//   // Start accepting tasks from the Task Queue.
//   await worker.run();
// }

// Example
async function run() {
  // Register Workflows and Activities with the Worker and connect to
  // the Temporal server.
  const worker = await Worker.create({
    workflowsPath: require.resolve('./examples/01_workflows'),
    activities,
    namespace,
    taskQueue: deepTaskQueueName,
    // reuseV8Context: true,
  });

  // Start accepting tasks from the Task Queue.
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

// @@@SNIPEND
