import { BigNumber } from 'bignumber.js';
import type { BeefyState } from '../../../redux-types';
import { formatTokenDisplayCondensed } from '../../../helpers/format';
import { isTokenErc20 } from '../entities/token';
import { type Step, StepContent } from '../reducers/wallet/stepper';
import type { TokenAmount } from '../apis/transact/transact-types';
import { selectChainNativeToken, selectTokenByAddressOrUndefined } from './tokens';
import { BIG_ZERO, fromWei, fromWeiString } from '../../../helpers/big-number';
import { selectVaultById } from './vaults';
import { ZERO_ADDRESS } from '../../../helpers/addresses';
import {
  type BridgeAdditionalData,
  isBaseAdditionalData,
  isBoostAdditionalData,
  isWalletActionBridgeSuccess,
  isWalletActionSuccess,
  isZapAdditionalData,
  type TrxReceipt,
  type WalletActionsSuccessState,
} from '../reducers/wallet/wallet-action';
import { decodeEventLog, getAddress } from 'viem';
import { uniqBy } from 'lodash-es';
import { ERC20Abi } from '../../../config/abi/ERC20Abi';
import type { Hex } from 'viem/types/misc';
import { selectBoostById } from './boosts';
import { isDefined } from '../utils/array-utils';

export const selectStepperState = (state: BeefyState) => {
  return state.ui.stepperState;
};

export const selectStepperChainId = (state: BeefyState) => {
  return state.ui.stepperState.chainId;
};

export const selectIsStepperStepping = (state: BeefyState) => {
  return state.ui.stepperState.modal && state.ui.stepperState.stepContent !== StepContent.SuccessTx;
};

export const selectStepperCurrentStep = (state: BeefyState) => {
  return state.ui.stepperState.currentStep;
};

export const selectStepperCurrentStepData = (state: BeefyState): Step => {
  const currentStep = state.ui.stepperState.currentStep;
  return state.ui.stepperState.items[currentStep];
};

export const selectStepperItems = (state: BeefyState) => {
  return state.ui.stepperState.items;
};

export const selectStepperStepContent = (state: BeefyState) => {
  return state.ui.stepperState.stepContent;
};

export function selectMintResult(state: BeefyState) {
  if (!isWalletActionSuccess(state.user.walletActions)) {
    throw new Error('Not wallet action success');
  }

  if (!isBaseAdditionalData(state.user.walletActions.additional)) {
    throw new Error('Missing wallet additional data');
  }

  const { receipt } = state.user.walletActions.data;
  const { token: mintToken, amount } = state.user.walletActions.additional;

  const result = {
    type: 'mint',
    amount: formatTokenDisplayCondensed(amount, mintToken.decimals),
    token: mintToken,
  };

  if (
    !mintToken ||
    !isTokenErc20(mintToken) ||
    !receipt ||
    !receipt.events ||
    !('Transfer' in receipt.events)
  ) {
    return result;
  }

  const userAddress = receipt.from.toLowerCase();
  const mintContractAddress = receipt.to.toLowerCase();
  const mintTokenAddress = mintToken.address.toLowerCase();
  const transferEvents = Array.isArray(receipt.events['Transfer'])
    ? receipt.events['Transfer']
    : [receipt.events['Transfer']];
  const mintTransferEvent = transferEvents.find(
    e =>
      e.address.toLowerCase() === mintTokenAddress &&
      e.returnValues.to.toLowerCase() === mintContractAddress &&
      e.returnValues.from.toLowerCase() === ZERO_ADDRESS
  );
  const userTransferEvent = transferEvents.find(
    e =>
      e.address.toLowerCase() === mintTokenAddress &&
      e.returnValues.to.toLowerCase() === userAddress &&
      e.returnValues.from.toLowerCase() === mintContractAddress
  );

  if (!mintTransferEvent && userTransferEvent) {
    result.type = 'buy';
    result.amount = formatTokenDisplayCondensed(
      fromWei(userTransferEvent.returnValues.value, mintToken.decimals),
      mintToken.decimals
    );
  }

  return result;
}

export function selectBridgeSuccess(
  state: BeefyState
): WalletActionsSuccessState<BridgeAdditionalData> {
  if (isWalletActionBridgeSuccess(state.user.walletActions)) {
    return state.user.walletActions;
  }

  throw new Error('Not bridge success');
}

export function selectBoostAdditionalData(state: BeefyState) {
  if (isBoostAdditionalData(state.user.walletActions.additional)) {
    return state.user.walletActions.additional;
  }
  return undefined;
}

export function selectBoostClaimed(state: BeefyState) {
  if (!isWalletActionSuccess(state.user.walletActions)) {
    return [];
  }
  if (!isBoostAdditionalData(state.user.walletActions.additional)) {
    return [];
  }

  const { receipt } = state.user.walletActions.data;
  const { boostId, token, walletAddress } = state.user.walletActions.additional;

  if (!boostId || !receipt || !receipt.events) {
    return [];
  }

  const boost = selectBoostById(state, boostId);

  // Tokens sent from boost to the user, excluding the vault token
  const from = getAddress(boost.contractAddress);
  const to = getAddress(walletAddress);
  const contract = getAddress(token.address);
  const transferEvents = getTransferEvents(receipt.events).filter(
    e => e.args.from === from && e.args.to === to && e.contract !== contract
  );

  return transferEvents
    .map(e => {
      const token = selectTokenByAddressOrUndefined(state, boost.chainId, e.contract);
      if (!token) {
        return undefined;
      }
      const amount = fromWeiString(e.args.value.toString(), token.decimals);
      if (amount.lte(BIG_ZERO)) {
        return undefined;
      }
      return {
        token,
        amount,
      };
    })
    .filter(isDefined);
}

const TransferEventTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/** Takes events from web3 receipt and decodes the Transfer events using viem */
function getTransferEvents(events: TrxReceipt['events']) {
  if (events === undefined) {
    return [];
  }

  const transferLogs = uniqBy(
    Object.values(events).flatMap(eventOrEvents => {
      const events = Array.isArray(eventOrEvents) ? eventOrEvents : [eventOrEvents];
      return events.filter(event => event.raw?.topics[0] === TransferEventTopic);
    }),
    e => `${e.transactionHash}-${e.logIndex}`
  );

  return transferLogs.map(log => {
    const event = decodeEventLog({
      abi: ERC20Abi,
      data: log.raw?.data as Hex | undefined,
      eventName: 'Transfer',
      strict: true,
      topics: log.raw?.topics as [Hex, ...Hex[]],
    });
    return { ...event, contract: getAddress(log.address) };
  });
}

export const selectStepperProgress = (state: BeefyState) => {
  const currentStep = state.ui.stepperState.currentStep;
  const percentagePerStep = 100 / state.ui.stepperState.items.length;
  const currentTxProgress = selectStandardTxPercentage(state);

  return currentStep * percentagePerStep + percentagePerStep * currentTxProgress;
};

/**
 * Each Standard Tx have 3 possible scenarios
 * 1 - need user interaction
 * 2 - tx mining
 * 3 - tx mined
 */
const selectStandardTxPercentage = (state: BeefyState) => {
  const walletActionsStateResult = state.user.walletActions.result;
  if (walletActionsStateResult === null) {
    return 0;
  } else if (walletActionsStateResult === 'success_pending') {
    return 0.5;
  }

  return 0;
};

export const selectErrorBar = (state: BeefyState) => {
  const walletActionsStateResult = state.user.walletActions.result;

  return walletActionsStateResult === 'error';
};

export const selectSuccessBar = (state: BeefyState) => {
  const stepContent = state.ui.stepperState.stepContent;

  return stepContent === StepContent.SuccessTx;
};

export function selectZapReturned(state: BeefyState) {
  if (!isWalletActionSuccess(state.user.walletActions)) {
    return [];
  }
  if (!isZapAdditionalData(state.user.walletActions.additional)) {
    return [];
  }

  const { receipt } = state.user.walletActions.data;
  const { vaultId, expectedTokens } = state.user.walletActions.additional;

  if (!vaultId || !receipt || !receipt.events || !('TokenReturned' in receipt.events)) {
    return [];
  }

  // We need to know what normal tokens to expect, so we don't show them as dust
  if (!expectedTokens || !expectedTokens.length) {
    return [];
  }
  const expectedTokensAddresses: Set<string> = new Set(
    expectedTokens.map(t => t.address.toLowerCase())
  );

  const vault = selectVaultById(state, vaultId);
  const zapAddress = receipt.to.toLowerCase();
  const returnEvents = (
    Array.isArray(receipt.events['TokenReturned'])
      ? receipt.events['TokenReturned']
      : [receipt.events['TokenReturned']]
  ).filter(e => e.address.toLowerCase() === zapAddress);

  if (!returnEvents.length) {
    return [];
  }

  const minAmount = new BigNumber('0.00000001');
  const native = selectChainNativeToken(state, vault.chainId);
  const tokenAmounts: TokenAmount[] = returnEvents
    .map(e => {
      const token =
        e.returnValues.token === ZERO_ADDRESS
          ? native
          : selectTokenByAddressOrUndefined(state, vault.chainId, e.returnValues.token);

      return {
        amount: token ? fromWeiString(e.returnValues.amount, token.decimals) : BIG_ZERO,
        token,
      };
    })
    .filter((t): t is TokenAmount => !!t.token)
    .filter(t => !expectedTokensAddresses.has(t.token.address.toLowerCase()))
    .filter(t => t.amount.gte(minAmount));

  return tokenAmounts;
}
