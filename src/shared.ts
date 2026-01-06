// @@@SNIPSTART money-transfer-project-template-ts-constants
export const namespace = 'rrq';
export const taskQueueName = 'transfer-queue';
export const deepTaskQueueName = 'deep-queue';
// @@@SNIPEND

// @@@SNIPSTART money-transfer-project-template-ts-shared

export type PaymentDetails = {
  amount: number;
  sourceAccount: string;
  targetAccount: string;
  referenceId: string;
};

// @@@SNIPEND
