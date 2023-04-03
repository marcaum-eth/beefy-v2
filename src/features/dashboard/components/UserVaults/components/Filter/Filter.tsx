import { InputBase, makeStyles } from '@material-ui/core';
import React, { ChangeEvent, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { SortColumnHeader } from '../../../../../../components/SortColumnHeader';
import { styles } from './styles';

const useStyles = makeStyles(styles);

interface FilterProps {
  sortOptions: any;
  handleSort: (field: string) => void;
  handleSearchText: (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  searchText: string;
}

export const Filter = memo<FilterProps>(
  ({ sortOptions, handleSort, handleSearchText, searchText }) => {
    const classes = useStyles();
    return (
      <div className={classes.container}>
        <Search handleSearchText={handleSearchText} searchText={searchText} />
        <SortColumns sortOptions={sortOptions} handleSort={handleSort} />
      </div>
    );
  }
);

interface SearchProps {
  handleSearchText: (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  searchText: string;
}

const Search = memo<SearchProps>(function Search({ handleSearchText, searchText }) {
  const { t } = useTranslation();
  const classes = useStyles();

  return (
    <InputBase
      className={classes.search}
      value={searchText}
      onChange={handleSearchText}
      fullWidth={true}
      placeholder={t('Filter-Search')}
    />
  );
});

const SORT_COLUMNS: {
  label: string;
  sortKey: string;
  className?: string;
}[] = [
  { label: 'Dashboard-Filter-AtDeposit', sortKey: 'atDeposit', className: 'hideSm' },
  { label: 'Dashboard-Filter-Now', sortKey: 'now', className: 'hideSm' },
  { label: 'Dashboard-Filter-Yield', sortKey: 'yield', className: 'hideSm' },
  { label: 'Dashboard-Filter-Pnl', sortKey: 'pnl' },
  { label: 'Dashboard-Filter-Apy', sortKey: 'apy', className: 'hideMd' },
  { label: 'Dashboard-Filter-DailyYield', sortKey: 'dailyYield', className: 'hideMd' },
];

interface SortColumnsProps {
  sortOptions: any;
  handleSort: (field: string) => void;
}

const SortColumns = memo<SortColumnsProps>(function SortColumns({ sortOptions, handleSort }) {
  const classes = useStyles();

  const { sort, sortDirection } = sortOptions;
  return (
    <div className={classes.sortColumns}>
      {SORT_COLUMNS.map(({ label, sortKey, className }) => (
        <SortColumnHeader
          key={label}
          label={label}
          sortKey={sortKey}
          sorted={sort === sortKey ? sortDirection : 'none'}
          onChange={handleSort}
          className={className ? classes[className] : ''}
        />
      ))}
    </div>
  );
});
