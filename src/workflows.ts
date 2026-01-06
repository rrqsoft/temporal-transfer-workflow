/* eslint-disable @typescript-eslint/no-unused-vars */
// @@@SNIPSTART money-transfer-project-template-ts-workflow
import {
  CancellationScope,
  proxyActivities,
  setHandler,
  sleep,
  workflowInfo,
} from '@temporalio/workflow';
import { ApplicationFailure, CancelledFailure } from '@temporalio/common';
import type * as activities from './activities';
import type { PaymentDetails } from './shared';
import { manualCancel } from './signals';
import { withdrawResultQuery } from './queries';

// Get the Activities for the Workflow and set up the Activity Options.
const { withdraw, refund } = proxyActivities<typeof activities>({
  // RetryPolicy specifies how to automatically handle retries if an Activity fails.
  retry: {
    initialInterval: '1 second',
    maximumInterval: '1 minute',
    backoffCoefficient: 2,
    maximumAttempts: 500,
    nonRetryableErrorTypes: ['InvalidAccountError', 'InsufficientFundsError'],
  },
  startToCloseTimeout: '1 minute',
});

const withTimeoutWithdrawal = (
  details: PaymentDetails
): { controller: AbortController; result: Promise<string> } => {
  const controller = new AbortController();

  return {
    controller,
    result: CancellationScope.withTimeout(3000, async () => {
      await sleep(5000);
      return withdraw(details);
    }),
  };
};

export async function moneyTransfer(details: PaymentDetails): Promise<string> {
  // let canceled = false;

  let withdrawResult: string;

  setHandler(withdrawResultQuery, () => {
    return {
      withdrawResult,
      ...workflowInfo(),
    };
  });

  setHandler(manualCancel, (input) => {
    console.log(`Manual cancel: ${input.name}`);
    // canceled = true;
  });

  const { deposit } = proxyActivities<typeof activities>({
    retry: {
      initialInterval: '1 second',
      maximumInterval: '1 minute',
      backoffCoefficient: 2,
      maximumAttempts: 50,
    },
    startToCloseTimeout: '1 minute',
  });

  // Execute the withdraw Activity
  let controller: AbortController | undefined = undefined;
  try {
    withdrawResult = await withdraw(details);
    // withdrawResult = await res.result;
    // controller = res.controller;
  } catch (withdrawErr) {
    if (withdrawErr instanceof CancelledFailure && controller) {
      // controller.abort();
    }
    throw new ApplicationFailure(`Withdrawal failed. Error: ${withdrawErr}`);
  }

  // Execute the deposit Activity
  let depositResult: string;
  try {
    depositResult = await deposit(details);
  } catch (depositErr) {
    // The deposit failed; try to refund the money.
    let refundResult;
    try {
      refundResult = await refund(details);
    } catch (refundErr) {
      throw ApplicationFailure.create({
        message: `Failed to deposit money into account ${details.targetAccount}. Money could not be returned to ${details.sourceAccount}. Cause: ${refundErr}.`,
      });
    }
    throw ApplicationFailure.create({
      message: `Failed to deposit money into account ${details.targetAccount}. Money returned to ${details.sourceAccount}. Cause: ${depositErr}.`,
    });
  }

  return `Transfer complete (transaction IDs: ${withdrawResult}, ${depositResult})`;
}

// @@@SNIPEND
