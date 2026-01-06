import { promisify } from 'util';

const nodeSync = promisify(setTimeout);

export async function parent(): Promise<void> {
  console.log('parent');

  await nodeSync(2000);

  console.log('still going');
}
