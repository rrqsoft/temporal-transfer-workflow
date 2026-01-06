import { defineSignal } from '@temporalio/workflow';

interface ICancelInput {
  name: string;
}
export const manualCancel = defineSignal<[ICancelInput]>('manual-cancel');
