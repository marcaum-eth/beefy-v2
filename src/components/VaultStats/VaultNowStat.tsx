import { VaultEntity } from '../../features/data/entities/vault';
import { memo } from 'react';
import { connect } from 'react-redux';
import { BeefyState } from '../../redux-types';
import {
  formatBigUsd,
  formatFullBigNumber,
  formatSignificantBigNumber,
} from '../../helpers/format';
import { VaultValueStat } from '../VaultValueStat';
import {
  selectIsAnalyticsLoaded,
  selectUserDepositedTimelineByVaultId,
  selectVaultPnl,
} from '../../features/data/selectors/analytics';
import { BasicTooltipContent } from '../Tooltip/BasicTooltipContent';

export type VaultNowStatProps = {
  vaultId: VaultEntity['id'];
  className?: string;

  triggerClassName?: string;
};

export const VaultNowStat = memo(connect(mapStateToProps)(VaultValueStat));

function mapStateToProps(
  state: BeefyState,
  { vaultId, className, triggerClassName }: VaultNowStatProps
) {
  const label = '-';

  const vaultTimeline = selectUserDepositedTimelineByVaultId(state, vaultId);

  const isLoaded = selectIsAnalyticsLoaded(state);

  if (!vaultTimeline) {
    return {
      label,
      value: '-',
      subValue: null,
      blur: false,
      loading: false,
      className: className ?? '',
    };
  }
  if (!isLoaded) {
    return {
      label,
      value: '-',
      subValue: null,
      blur: false,
      loading: true,
      className: className ?? '',
    };
  }

  const { deposit, depositUsd, oraclePrice, tokenDecimals } = selectVaultPnl(state, vaultId);

  return {
    label,
    value: formatSignificantBigNumber(deposit, tokenDecimals, oraclePrice, 0, 2),
    subValue: formatBigUsd(depositUsd),
    blur: false,
    loading: !isLoaded,
    boosted: false,
    tooltip: <BasicTooltipContent title={formatFullBigNumber(deposit, tokenDecimals)} />,
    className: className ?? '',
    triggerClassName: triggerClassName ?? '',
  };
}
