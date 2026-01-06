import { Client, Connection } from '@temporalio/client';
import { loadClientConnectConfig } from '@temporalio/envconfig';
import { query } from '../workflows';
import { namespace } from '../../shared';

export const run = async (proposal_id: string, isManual = false) => {
  const config = loadClientConnectConfig();
  const connection = await Connection.connect(config.connectionOptions);
  const client = new Client({ connection, namespace });

  const intervalInSeconds = 60;
  const endAtInSeconds = 200;
  const offsetSeconds = new Date().getSeconds() % intervalInSeconds;
  const schedule = await client.schedule.create({
    action: {
      taskQueue: 'schedulers',
      type: 'startWorkflow',
      args: [proposal_id, isManual],
      workflowType: query,
    },
    scheduleId: proposal_id,
    policies: {
      catchupWindow: '1 day', // recovery window (after server boots up in case of failure)
      pauseOnFailure: false,
    },
    spec: {
      intervals: [
        {
          every: `${intervalInSeconds} seconds`,
          offset: `${offsetSeconds} seconds`,
        },
      ],
      endAt: new Date(Date.now() + endAtInSeconds * 1000),
    },
    state: {
      remainingActions: isManual ? 1 : 2,
      note: isManual ? 'Only 1 time' : 'Only 3 times',
      triggerImmediately: true,
    },
  });

  console.log(`Schedule created: ${new Date()} ${schedule.scheduleId}`);

  await client.connection.close();
};
