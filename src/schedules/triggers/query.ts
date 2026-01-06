import { run as query } from './query_status';
import { DB } from '../db';

DB.getInstance().exec(`
  CREATE TABLE IF NOT EXISTS counter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    count INTEGER DEFAULT 0
  )
`);

interface TCounter {
  id: number;
  count: number;
}

const run = async () => {
  try {
    let currentCount = await DB.getInstance()
      .prepare<unknown[], TCounter>('SELECT count FROM counter WHERE id = 1')
      .get([]);
    if (currentCount) {
      DB.getInstance()
        .prepare('UPDATE counter SET count = count + 1 WHERE id = ?')
        .run(1);
      currentCount = DB.getInstance()
        .prepare<unknown[], TCounter>('SELECT count FROM counter WHERE id = 1')
        .get([]);
    } else {
      DB.getInstance().prepare('INSERT INTO counter (count) VALUES (1)').run();
    }

    const counter = currentCount ? currentCount.count : 0;

    await query(`RRQ${counter}`, false);
  } catch (e) {
    console.error(e);
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
