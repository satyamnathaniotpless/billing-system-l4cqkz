import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { Box, Typography, Skeleton, Alert } from '@mui/material';
import { GridColDef, GridSortModel, GridFilterModel, GridValueFormatterParams } from '@mui/x-data-grid';
import { DataGrid } from '../common/DataGrid';
import { useWallet } from '../../hooks/useWallet';
import { formatCurrency } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import { TransactionType, TransactionStatus } from '../../types/wallet';

interface TransactionHistoryProps {
  customerId: string;
  pageSize?: number;
  refreshInterval?: number;
  locale?: string;
  timezone?: string;
}

/**
 * Transaction history component with real-time updates and accessibility support
 * @version 1.0.0
 */
const TransactionHistory: React.FC<TransactionHistoryProps> = memo(({
  customerId,
  pageSize = 10,
  refreshInterval = 30000,
  locale = 'en-US',
  timezone = 'UTC'
}) => {
  // Wallet hook for managing transactions
  const {
    transactions,
    loading,
    error,
    pagination,
    fetchTransactions,
    connectionStatus
  } = useWallet(customerId, {
    enableRealTimeUpdates: true,
    cacheTimeout: refreshInterval
  });

  // Column definitions with accessibility support
  const columns = useMemo((): GridColDef[] => [
    {
      field: 'id',
      headerName: 'Transaction ID',
      width: 200,
      sortable: true,
      hideable: false,
      renderCell: (params) => (
        <Typography
          variant="body2"
          component="span"
          sx={{ fontFamily: 'var(--font-family-mono)' }}
          aria-label={`Transaction ID: ${params.value}`}
        >
          {params.value}
        </Typography>
      )
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 120,
      sortable: true,
      renderCell: (params) => {
        const type = params.value as TransactionType;
        const color = type === TransactionType.CREDIT ? 'success.main' : 
                     type === TransactionType.DEBIT ? 'error.main' : 'warning.main';
        
        return (
          <Typography
            variant="body2"
            color={color}
            aria-label={`Transaction type: ${type}`}
          >
            {type}
          </Typography>
        );
      }
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 150,
      sortable: true,
      valueFormatter: (params: GridValueFormatterParams) => {
        const amount = params.value as number;
        const type = params.row.type as TransactionType;
        const prefix = type === TransactionType.CREDIT ? '+' : 
                      type === TransactionType.DEBIT ? '-' : '';
        return `${prefix}${formatCurrency(amount, params.row.currency, { locale })}`;
      },
      renderCell: (params) => (
        <Typography
          variant="body2"
          color={params.row.type === TransactionType.CREDIT ? 'success.main' : 'error.main'}
          aria-label={`Amount: ${params.value}`}
        >
          {params.value}
        </Typography>
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      sortable: true,
      renderCell: (params) => {
        const status = params.value as TransactionStatus;
        const color = status === TransactionStatus.COMPLETED ? 'success.main' :
                     status === TransactionStatus.FAILED ? 'error.main' :
                     status === TransactionStatus.PROCESSING ? 'info.main' : 'warning.main';
        
        return (
          <Typography
            variant="body2"
            color={color}
            aria-label={`Status: ${status}`}
            role="status"
          >
            {status}
          </Typography>
        );
      }
    },
    {
      field: 'createdAt',
      headerName: 'Date',
      width: 180,
      sortable: true,
      valueFormatter: (params: GridValueFormatterParams) => 
        formatDate(params.value as string, timezone, { locale })
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1,
      sortable: false,
      renderCell: (params) => (
        <Typography
          variant="body2"
          noWrap
          title={params.value}
          aria-label={`Description: ${params.value}`}
        >
          {params.value}
        </Typography>
      )
    }
  ], [locale, timezone]);

  // Handle sort changes
  const handleSortChange = useCallback((sortModel: GridSortModel) => {
    if (sortModel.length > 0) {
      const { field, sort } = sortModel[0];
      fetchTransactions({
        page: pagination.page,
        limit: pageSize,
        sortBy: `${field}:${sort}`
      });
    }
  }, [fetchTransactions, pagination.page, pageSize]);

  // Handle filter changes
  const handleFilterChange = useCallback((filterModel: GridFilterModel) => {
    fetchTransactions({
      page: pagination.page,
      limit: pageSize,
      ...filterModel.items.reduce((acc, filter) => ({
        ...acc,
        [filter.field]: filter.value
      }), {})
    });
  }, [fetchTransactions, pagination.page, pageSize]);

  // Initial data fetch and refresh interval
  useEffect(() => {
    fetchTransactions({ page: 1, limit: pageSize });
    
    const intervalId = setInterval(() => {
      fetchTransactions({ page: pagination.page, limit: pageSize });
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [fetchTransactions, pageSize, refreshInterval, pagination.page]);

  // Loading state
  if (loading && !transactions.length) {
    return (
      <Box sx={{ width: '100%' }}>
        <Skeleton variant="rectangular" height={400} />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert 
        severity="error"
        sx={{ mb: 2 }}
        role="alert"
      >
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%' }}>
      {connectionStatus !== 'connected' && (
        <Alert 
          severity="warning"
          sx={{ mb: 2 }}
          role="alert"
        >
          Real-time updates are currently unavailable
        </Alert>
      )}
      
      <DataGrid
        rows={transactions}
        columns={columns}
        title="Transaction History"
        loading={loading}
        pagination
        pageSize={pageSize}
        rowCount={pagination.total}
        onSortModelChange={handleSortChange}
        onFilterModelChange={handleFilterChange}
        aria-label="Transaction history table"
        exportOptions={{
          formats: ['csv', 'pdf'],
          filename: 'transaction-history'
        }}
      />
    </Box>
  );
});

// Display name for debugging
TransactionHistory.displayName = 'TransactionHistory';

export default TransactionHistory;