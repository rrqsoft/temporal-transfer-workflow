import { DB } from './db';
const db = DB.getInstance();
import { sleep, Context, log } from '@temporalio/activity';

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
  setInterval(() => {
    // heartbeat
    Context.current().heartbeat('Pulsing every 1 second');
  }, 1000);
  await sleep(ms);
}

export async function revertRecord(str: string) {
  console.log(`Reverting record: ${str}`);

  const revertResult = db.prepare(`DELETE FROM records WHERE key = ?`).run(str);
  console.log('revertResult', revertResult);
}

interface IDeleteQueryStatusSchedulesOptions {
  success: boolean;
}
export const cleanUpScheduleWhenDone = async (
  proposal_id: string,
  options: IDeleteQueryStatusSchedulesOptions
) => {
  const client = Context.current().client;
  const handle = client.schedule.getHandle(proposal_id);

  if (!options.success) {
    return { scheduleDeleted: false, ...options };
  }
  await handle.delete();
  return { scheduleDeleted: true, ...options };
};

export const randomSuccess = async () => {
  await sleep(1000); // fake delay
  return Math.random() < 0.2;
};

export const unpauseQueryStatusSchedule = async (scheduleId: string) => {
  const client = Context.current().client;
  const handle = client.schedule.getHandle(scheduleId);
  await handle.unpause();
  console.log('unpaused schedule', scheduleId);
};

export const deleteReferenceSchedule = async (referenceId: string) => {
  const client = Context.current().client;
  const handle = client.schedule.getHandle(referenceId);
  try {
    await handle.delete();
  } catch (e) {
    log.info('Already deleted reference schedule ' + referenceId);
  }
};
