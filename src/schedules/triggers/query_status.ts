import { Client, Connection, ScheduleOverlapPolicy } from '@temporalio/client';
import { loadClientConnectConfig } from '@temporalio/envconfig';
import { query } from '../workflows';
import { namespace } from '../../shared';

export const run = async (proposal_id: string, isManual = false) => {
  const config = loadClientConnectConfig();
  const connection = await Connection.connect(config.connectionOptions);
  const client = new Client({ connection, namespace });

  const intervalInSeconds = 10;
  const bufferSeconds = 1;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const offsetSeconds = (nowSeconds + bufferSeconds) % intervalInSeconds;
  const schedule = await client.schedule.create({
    action: {
      taskQueue: 'schedulers',
      type: 'startWorkflow',
      args: [proposal_id, { isManual }],
      workflowType: query,
      staticDetails: ``,
      staticSummary: ``,
    },
    scheduleId: proposal_id,
    policies: {
      catchupWindow: '1 day', // recovery window (after server boots up in case of failure)
      pauseOnFailure: false,
      overlap: ScheduleOverlapPolicy.CANCEL_OTHER,
    },
    spec: {
      intervals: [
        {
          every: `${intervalInSeconds} seconds`,
          // must be used instead of triggered immediately logic
          offset: `${offsetSeconds} seconds`,
        },
      ],
    },
    state: {
      remainingActions: isManual ? 1 : 3,
      note: isManual ? 'Only 1 time' : 'Only 3 times',
      // ISSUE / Bug with ScheduleOverlapPolicy.CANCEL_OTHER
      // the Action triggered by "triggerImmediately" flag doesn't receive cancellation
      //   triggerImmediately: true,
    },
  });

  console.log(`Schedule created: ${schedule.scheduleId} ${new Date()}`);

  await client.connection.close();
};
