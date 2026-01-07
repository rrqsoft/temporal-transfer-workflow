import {
  abortQueryStatusSchedules,
  deleteQueryStatusSchedules,
  pauseQueryStatusSchedules,
} from '../utilities';
import { run as query } from './query_status';
import { DB } from '../db';

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

    // // do another query for query
    await query(`${id}-manual`, true);
  } catch (e) {
    console.error(e);
    throw e;
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
