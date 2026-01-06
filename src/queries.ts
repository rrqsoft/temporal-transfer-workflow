import { defineQuery } from '@temporalio/workflow';
export const selectFlows = defineQuery<
  { [k: string]: string },
  [{ [k: string]: string }]
>('select-flows');

export const withdrawResultQuery = defineQuery<
  unknown,
  [{ [k: string]: unknown }]
>('withdraw-result');
