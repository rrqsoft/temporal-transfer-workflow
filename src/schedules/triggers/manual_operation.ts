import {
  abortQueryStatusSchedules,
  pauseQueryStatusSchedules,
} from '../utilities';
import { DB } from '../db';
import { Client, Connection, WorkflowIdReusePolicy } from '@temporalio/client';
import { loadClientConnectConfig } from '@temporalio/envconfig';
import { namespace } from '../../shared';
import { query } from '../workflows';

const run = async () => {
  try {
    const lastProposalCounter = await DB.getInstance()
      .prepare<unknown[], { count: number }>(
        'SELECT count FROM counter WHERE id = 1'
      )
      .get([]);

    const currentCount = lastProposalCounter ? lastProposalCounter.count : 1;
    const id = `RRQ${currentCount}`;

    await pauseQueryStatusSchedules(id);

    // NOTE: abort the    current running workflow for this id
    await abortQueryStatusSchedules(id);
    // NOTE: delete all future scheduled workflows for this id
    // await deleteQueryStatusSchedules(id);

    // create individual workflow
    const config = loadClientConnectConfig();
    const connection = await Connection.connect(config.connectionOptions);
    const client = new Client({ connection, namespace });

    const handle = await client.workflow.start(query, {
      args: [`${id}-manual`, { isManual: true, referenceId: id }],
      taskQueue: 'status-manual-operations',
      workflowId: `${id}-manual`,
      workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE,
    });

    console.log(`Workflow started: ${handle.workflowId}`);
    console.log('Result (Manual Query):', await handle.result());

    await client.connection.close();
  } catch (e) {
    console.error(e);
    throw e;
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
