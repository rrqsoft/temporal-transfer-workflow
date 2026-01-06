import { loadClientConnectConfig } from '@temporalio/envconfig';
import { DB } from './db';
const db = DB.getInstance();
import { sleep, Context } from '@temporalio/activity';
import { Client, Connection } from '@temporalio/client';
import { namespace } from '../shared';

db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    key TEXT PRIMARY KEY,
    created_at INTEGER DEFAULT (unixepoch())
  )
`);

export async function checkStatus(str: string) {
  console.log(`Checking status: ${str}`);

  // await new Promise((resolve) => setTimeout(resolve, 5000 * 25)); // simulate delay

  return {
    ok: true,
  };
}

export async function writeRecord(str: string) {
  console.log(`Writing record: ${str}`);

  return {
    ...db.prepare(`INSERT OR REPLACE INTO records (key) VALUES (?)`).run(str),
  };
}

export async function _mockAdditionalActivities(ms = 5000 * 25) {
  await sleep(ms);
}

export async function revertRecord(str: string) {
  console.log(`Reverting record: ${str}`);

  const revertResult = db.prepare(`DELETE FROM records WHERE key = ?`).run(str);
  console.log('revertResult', revertResult);
}

interface IDeleteQueryStatusSchedulesOptions {
  maxActions: number;
  isManual: boolean;
}
export const deleteQueryStatusSchedules = async (
  proposal_id: string,
  options: IDeleteQueryStatusSchedulesOptions
) => {
  const client = Context.current().client;

  const handle = client.schedule.getHandle(proposal_id);

  const description = await handle.describe();
  const actionsTaken = description.info.numActionsTaken;
  if (actionsTaken < options.maxActions && !options.isManual) {
    console.log('Not deleting schedule', proposal_id, actionsTaken);
    return { scheduleDeleted: false };
  }
  console.log('Deleting schedule', proposal_id, actionsTaken);
  await handle.delete();
  return { scheduleDeleted: true };
};
