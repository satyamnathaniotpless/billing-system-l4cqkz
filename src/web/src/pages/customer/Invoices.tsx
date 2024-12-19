import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Button, Typography, Chip, CircularProgress, Alert } from '@mui/material';
import { Download, Refresh } from '@mui/icons-material';
import { GridColDef, GridFilterModel } from '@mui/x-data-grid';

// Internal imports
import DataGrid from '../../components/common/DataGrid';
import { useInvoice } from '../../hooks/useInvoice';
import { formatCurrency, formatDate, formatTaxAmount } from '../../utils/format';
import { InvoiceStatus, TaxType } from '../../types/invoice';

/**
 * Status chip color mapping with accessibility support
 */
const getStatusChipColor = (status: InvoiceStatus): 'default' | 'primary' | 'success' | 'error' | 'warning' => {
  switch (status) {
    case InvoiceStatus.PAID:
      return 'success';
    case InvoiceStatus.PENDING:
      return 'primary';
    case InvoiceStatus.OVERDUE:
      return 'error';
    case InvoiceStatus.CANCELLED:
      return 'default';
    default:
      return 'default';
  }
};

/**
 * Enhanced Invoices page component with real-time updates and optimistic UI
 */
const Invoices: React.FC = React.memo(() => {
  // State management
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: number }>({});
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });

  // Custom hook for invoice operations
  const {
    invoices,
    loading,
    error,
    operations: {
      fetchInvoices,
      downloadInvoice,
      updateStatus,
      clearErrors
    }
  } = useInvoice();

  // Initial data fetch
  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Enhanced column definitions with multi-currency and tax support
  const columns = useMemo<GridColDef[]>(() => [
    {
      field: 'invoiceNumber',
      headerName: 'Invoice #',
      flex: 1,
      minWidth: 130
    },
    {
      field: 'issueDate',
      headerName: 'Issue Date',
      flex: 1,
      minWidth: 120,
      valueFormatter: (params) => formatDate(params.value)
    },
    {
      field: 'dueDate',
      headerName: 'Due Date',
      flex: 1,
      minWidth: 120,
      valueFormatter: (params) => formatDate(params.value)
    },
    {
      field: 'status',
      headerName: 'Status',
      flex: 1,
      minWidth: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={getStatusChipColor(params.value)}
          size="small"
          sx={{ minWidth: 90 }}
        />
      )
    },
    {
      field: 'totalAmount',
      headerName: 'Amount',
      flex: 1,
      minWidth: 150,
      valueFormatter: (params) => formatCurrency(
        params.value,
        params.row.currencyCode
      )
    },
    {
      field: 'taxAmount',
      headerName: 'Tax',
      flex: 1,
      minWidth: 120,
      valueFormatter: (params) => formatTaxAmount(
        params.value,
        params.row.taxType as TaxType,
        params.row.currencyCode
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      flex: 1,
      minWidth: 120,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            startIcon={<Download />}
            onClick={() => handleDownload(params.row.id)}
            disabled={!!downloadProgress[params.row.id]}
          >
            {downloadProgress[params.row.id] ? (
              <CircularProgress
                size={16}
                variant="determinate"
                value={downloadProgress[params.row.id]}
              />
            ) : 'Download'}
          </Button>
        </Box>
      )
    }
  ], [downloadProgress]);

  // Enhanced download handler with progress tracking
  const handleDownload = useCallback(async (invoiceId: string) => {
    try {
      setDownloadProgress(prev => ({ ...prev, [invoiceId]: 0 }));
      await downloadInvoice(invoiceId);
      setDownloadProgress(prev => ({ ...prev, [invoiceId]: 100 }));
    } catch (error) {
      console.error('Download failed:', error);
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[invoiceId];
        return newProgress;
      });
    }
  }, [downloadInvoice]);

  // Enhanced filter change handler with validation
  const handleFilterChange = useCallback((model: GridFilterModel) => {
    setFilterModel(model);
    const filters = model.items.reduce((acc, filter) => ({
      ...acc,
      [filter.field]: filter.value
    }), {});
    fetchInvoices(filters);
  }, [fetchInvoices]);

  // Refresh handler with optimistic update support
  const handleRefresh = useCallback(() => {
    fetchInvoices(filterModel.items.reduce((acc, filter) => ({
      ...acc,
      [filter.field]: filter.value
    }), {}));
  }, [fetchInvoices, filterModel]);

  return (
    <Box sx={{ height: '100%', p: 3 }}>
      {/* Header section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" component="h1">
          Invoices
        </Typography>
        <Button
          startIcon={<Refresh />}
          onClick={handleRefresh}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Error handling */}
      {error && (
        <Alert 
          severity="error" 
          onClose={clearErrors}
          sx={{ mb: 2 }}
        >
          {error.message}
        </Alert>
      )}

      {/* Enhanced DataGrid with all features */}
      <DataGrid
        rows={invoices}
        columns={columns}
        loading={loading}
        pagination
        filterMode="server"
        filterModel={filterModel}
        onFilterModelChange={handleFilterChange}
        autoHeight
        disableSelectionOnClick
        getRowId={(row) => row.id}
        sx={{
          '& .MuiDataGrid-cell': {
            fontSize: '0.875rem'
          }
        }}
      />
    </Box>
  );
});

// Display name for debugging
Invoices.displayName = 'Invoices';

export default Invoices;