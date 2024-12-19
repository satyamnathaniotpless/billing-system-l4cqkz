import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { 
  GridColDef, 
  GridSortModel, 
  GridFilterModel,
  GridRowParams,
  GridValueFormatterParams
} from '@mui/x-data-grid';
import { Box, Button, MenuItem, Select, TextField, Skeleton, Alert } from '@mui/material';
import { useDebounce } from 'use-debounce';

// Internal imports
import DataGrid from '../common/DataGrid';
import { useCustomer } from '../../hooks/useCustomer';
import { formatCurrency } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import { CustomerStatus, CustomerType, Customer } from '../../types/customer';
import { VALIDATION_RULES } from '../../config/constants';

// Interface definitions
interface CustomerListProps {
  onCustomerSelect?: (customer: Customer) => void;
  initialFilters?: CustomerFilters;
  onError?: (error: Error) => void;
}

interface CustomerFilters {
  status?: CustomerStatus;
  type?: CustomerType;
  search?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

const CustomerList: React.FC<CustomerListProps> = React.memo(({
  onCustomerSelect,
  initialFilters,
  onError
}) => {
  // Hooks
  const {
    customers,
    loading,
    error,
    pagination,
    fetchCustomers,
    debouncedFetchCustomers,
    refreshCache
  } = useCustomer();

  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<CustomerFilters>(initialFilters || {});
  const [debouncedSearch] = useDebounce(searchTerm, 300);

  // Effect for search term changes
  useEffect(() => {
    if (debouncedSearch !== undefined) {
      debouncedFetchCustomers({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch, debouncedFetchCustomers, filters]);

  // Effect for initial load and filter changes
  useEffect(() => {
    fetchCustomers(filters).catch(error => {
      onError?.(error);
    });
  }, [fetchCustomers, filters, onError]);

  // Column definitions
  const columns = useMemo((): GridColDef[] => [
    {
      field: 'id',
      headerName: 'ID',
      width: 120,
      renderCell: (params) => (
        <Button
          variant="text"
          onClick={() => onCustomerSelect?.(params.row)}
          aria-label={`View customer ${params.value}`}
        >
          {params.value}
        </Button>
      )
    },
    {
      field: 'name',
      headerName: 'Customer Name',
      flex: 1,
      minWidth: 200,
      filterable: true,
      sortable: true
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1,
      minWidth: 200,
      valueFormatter: (params: GridValueFormatterParams) => {
        const email = params.value as string;
        return email.length > VALIDATION_RULES.EMAIL.MAX_LENGTH 
          ? `${email.substring(0, VALIDATION_RULES.EMAIL.MAX_LENGTH)}...`
          : email;
      }
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 150,
      type: 'singleSelect',
      valueOptions: Object.values(CustomerType),
      renderCell: (params) => (
        <Box sx={{ 
          color: params.value === CustomerType.ENTERPRISE ? 'primary.main' : 'text.primary'
        }}>
          {params.value}
        </Box>
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      type: 'singleSelect',
      valueOptions: Object.values(CustomerStatus),
      renderCell: (params) => (
        <Box sx={{ 
          p: 1, 
          borderRadius: 1,
          bgcolor: getStatusColor(params.value as CustomerStatus),
          color: 'common.white'
        }}>
          {params.value}
        </Box>
      )
    },
    {
      field: 'walletBalance',
      headerName: 'Wallet Balance',
      width: 150,
      type: 'number',
      valueFormatter: (params: GridValueFormatterParams) => 
        formatCurrency(params.value as number, 'USD'),
      cellClassName: (params) => {
        const balance = params.value as number;
        return balance < 100 ? 'low-balance' : '';
      }
    },
    {
      field: 'createdAt',
      headerName: 'Created Date',
      width: 180,
      valueFormatter: (params: GridValueFormatterParams) =>
        formatDate(params.value as string)
    }
  ], [onCustomerSelect]);

  // Handlers
  const handleFilterChange = useCallback((field: keyof CustomerFilters, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  }, []);

  const handleSortModelChange = useCallback((model: GridSortModel) => {
    const [sort] = model;
    if (sort) {
      setFilters(prev => ({
        ...prev,
        sortBy: sort.field,
        sortOrder: sort.sort as 'asc' | 'desc'
      }));
    }
  }, []);

  const handleFilterModelChange = useCallback((model: GridFilterModel) => {
    const filterValues = model.items.reduce((acc, item) => ({
      ...acc,
      [item.field]: item.value
    }), {});
    setFilters(prev => ({ ...prev, ...filterValues }));
  }, []);

  // Helper function for status colors
  const getStatusColor = (status: CustomerStatus): string => {
    switch (status) {
      case CustomerStatus.ACTIVE:
        return 'success.main';
      case CustomerStatus.INACTIVE:
        return 'warning.main';
      case CustomerStatus.SUSPENDED:
        return 'error.main';
      default:
        return 'grey.500';
    }
  };

  // Render loading state
  if (loading && !customers.length) {
    return <Skeleton variant="rectangular" height={400} />;
  }

  // Render error state
  if (error && !customers.length) {
    return (
      <Alert 
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={refreshCache}>
            Retry
          </Button>
        }
      >
        {error.customers}
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Filter toolbar */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Search"
          value={searchTerm}
          onChange={handleSearchChange}
          size="small"
          placeholder="Search customers..."
          sx={{ minWidth: 200 }}
        />
        
        <Select
          value={filters.status || ''}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          size="small"
          displayEmpty
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">All Status</MenuItem>
          {Object.values(CustomerStatus).map(status => (
            <MenuItem key={status} value={status}>{status}</MenuItem>
          ))}
        </Select>

        <Select
          value={filters.type || ''}
          onChange={(e) => handleFilterChange('type', e.target.value)}
          size="small"
          displayEmpty
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">All Types</MenuItem>
          {Object.values(CustomerType).map(type => (
            <MenuItem key={type} value={type}>{type}</MenuItem>
          ))}
        </Select>
      </Box>

      {/* Data grid */}
      <DataGrid
        rows={customers}
        columns={columns}
        loading={loading}
        error={error?.customers}
        pagination
        paginationMode="server"
        rowCount={pagination.total}
        page={pagination.page - 1}
        pageSize={pagination.limit}
        onPageChange={(page) => fetchCustomers(filters, page + 1, pagination.limit)}
        onPageSizeChange={(pageSize) => fetchCustomers(filters, 1, pageSize)}
        sortingMode="server"
        onSortModelChange={handleSortModelChange}
        filterMode="server"
        onFilterModelChange={handleFilterModelChange}
        disableSelectionOnClick
        autoHeight
        getRowId={(row) => row.id}
        sx={{
          '& .low-balance': {
            color: 'error.main'
          }
        }}
      />
    </Box>
  );
});

// Display name for debugging
CustomerList.displayName = 'CustomerList';

export default CustomerList;