import { Connection, Client } from '@temporalio/client';
import { deepOperations } from './01_workflows';

import { namespace, deepTaskQueueName } from '../shared';

async function run() {
  const connection = await Connection.connect();
  const client = new Client({ connection, namespace });

  const handle = await client.workflow.start(deepOperations, {
    args: [],
    taskQueue: deepTaskQueueName,
    workflowId: 'deep-operations-810',
  });

  console.log(await handle.result());

  await connection.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
