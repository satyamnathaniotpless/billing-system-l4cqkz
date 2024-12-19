import React, { useCallback, useState, useEffect } from 'react';
import { Box, Button, Dialog } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Internal components
import CustomerList from '../../components/customer/CustomerList';
import CustomerForm from '../../components/customer/CustomerForm';
import PageHeader from '../../components/common/PageHeader';

// Hooks and utilities
import { useCustomer } from '../../hooks/useCustomer';
import { Customer, CustomerFilters } from '../../types/customer';

/**
 * Customers page component for managing customer accounts
 * Implements customer listing, filtering, and CRUD operations
 */
const Customers: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Customer management hook
  const {
    customers,
    loading,
    error,
    pagination,
    fetchCustomers,
    createCustomer,
    updateCustomer,
    debouncedFetchCustomers,
    refreshCache
  } = useCustomer();

  // Local state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [filters, setFilters] = useState<CustomerFilters>(() => ({
    status: searchParams.get('status') || undefined,
    type: searchParams.get('type') || undefined,
    search: searchParams.get('search') || undefined,
    dateRange: searchParams.get('dateRange') 
      ? JSON.parse(searchParams.get('dateRange')!) 
      : undefined
  }));

  // Effect to sync URL params with filters
  useEffect(() => {
    const newParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, typeof value === 'object' ? JSON.stringify(value) : value);
      }
    });
    setSearchParams(newParams);
  }, [filters, setSearchParams]);

  // Handlers
  const handleCreateCustomer = useCallback(async (customerData: Omit<Customer, 'id'>) => {
    try {
      await createCustomer(customerData);
      setIsFormOpen(false);
      refreshCache(); // Refresh list after creation
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error; // Let the form handle the error display
    }
  }, [createCustomer, refreshCache]);

  const handleUpdateCustomer = useCallback(async (customerData: Customer) => {
    try {
      await updateCustomer(customerData.id, customerData);
      setIsFormOpen(false);
      setSelectedCustomer(null);
      refreshCache(); // Refresh list after update
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }, [updateCustomer, refreshCache]);

  const handleCustomerSelect = useCallback((customer: Customer) => {
    navigate(`/admin/customers/${customer.id}`, { 
      state: { customer, filters } // Preserve filters for back navigation
    });
  }, [navigate, filters]);

  const handleFilterChange = useCallback((newFilters: CustomerFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const handleFormClose = useCallback(() => {
    setIsFormOpen(false);
    setSelectedCustomer(null);
  }, []);

  // Page actions
  const pageActions = [
    <Button
      key="create"
      variant="contained"
      color="primary"
      startIcon={<AddIcon />}
      onClick={() => setIsFormOpen(true)}
      aria-label="Create new customer"
    >
      New Customer
    </Button>
  ];

  // Breadcrumb configuration
  const breadcrumbs = [
    { label: 'Dashboard', href: '/admin/dashboard' },
    { label: 'Customers' }
  ];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Page Header */}
      <PageHeader
        title="Customers"
        subtitle="Manage customer accounts and view customer data"
        actions={pageActions}
        breadcrumbs={breadcrumbs}
      />

      {/* Customer List */}
      <Box sx={{ flex: 1, p: 3 }}>
        <CustomerList
          onCustomerSelect={handleCustomerSelect}
          initialFilters={filters}
          onError={(error) => {
            console.error('Customer list error:', error);
            // Could implement a toast notification here
          }}
        />
      </Box>

      {/* Customer Form Dialog */}
      <Dialog
        open={isFormOpen}
        onClose={handleFormClose}
        maxWidth="md"
        fullWidth
        aria-labelledby="customer-form-dialog"
      >
        <CustomerForm
          initialData={selectedCustomer || undefined}
          onSubmit={selectedCustomer ? handleUpdateCustomer : handleCreateCustomer}
          onCancel={handleFormClose}
          isLoading={loading}
          validationMode="onBlur"
        />
      </Dialog>
    </Box>
  );
};

// Display name for debugging
Customers.displayName = 'CustomersPage';

export default Customers;