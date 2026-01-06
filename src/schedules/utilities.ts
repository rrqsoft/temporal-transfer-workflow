import { Client, Connection } from '@temporalio/client';
import { loadClientConnectConfig } from '@temporalio/envconfig';
import { namespace } from '../shared';
import { abortSignal } from './signals';

export const deleteQueryStatusSchedules = async (proposal_id: string) => {
  const config = loadClientConnectConfig();
  const connection = await Connection.connect(config.connectionOptions);
  const client = new Client({ connection, namespace });

  const handle = client.schedule.getHandle(proposal_id);
  await handle.delete();
};

export const pauseQueryStatusSchedules = async (proposal_id: string) => {
  const config = loadClientConnectConfig();
  const connection = await Connection.connect(config.connectionOptions);
  const client = new Client({ connection, namespace });

  const handle = client.schedule.getHandle(proposal_id);
  await handle.pause();
  console.log('paused schedule', proposal_id);
};

export const abortQueryStatusSchedules = async (proposal_id: string) => {
  const config = loadClientConnectConfig();
  const connection = await Connection.connect(config.connectionOptions);
  const client = new Client({ connection, namespace });

  const scheduleHandle = client.schedule.getHandle(proposal_id);
  const description = await scheduleHandle.describe();

  for (const running of description.info.runningActions) {
    const workflowHandle = client.workflow.getHandle(
      running.workflow.workflowId
    );
    console.log('aborting workflow', running.workflow.workflowId);
    await workflowHandle.signal(abortSignal);
  }
};
