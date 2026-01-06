// @@@SNIPSTART money-transfer-project-template-ts-start-workflow
import { Connection, Client } from '@temporalio/client';
import { deepOperations } from './workflows';
import type { PaymentDetails } from './shared';

import { namespace, deepTaskQueueName } from './shared';

async function run() {
  const connection = await Connection.connect();
  const client = new Client({ connection, namespace });
  const details: PaymentDetails = {
    amount: 400,
    sourceAccount: '85-150',
    targetAccount: '43-812',
    referenceId: '12345',
  };

  const handle = await client.workflow.start(deepOperations, {
    args: [],
    taskQueue: deepTaskQueueName,
    workflowId: 'deep-operations-810',
    // signal: manualCancel,
    // signalArgs: [{ name: 'System' }],
  });

  console.log(await handle.result());

  await connection.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
// @@@SNIPEND
