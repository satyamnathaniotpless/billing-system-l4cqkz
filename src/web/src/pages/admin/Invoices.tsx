import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Badge,
  Box,
  Stack
} from '@mui/material';
import { Add as AddIcon, Download, Print, Edit } from '@mui/icons-material';

// Internal imports
import PageHeader from '../../components/common/PageHeader';
import DataGrid from '../../components/common/DataGrid';
import InvoiceGenerator from '../../components/billing/InvoiceGenerator';
import { useInvoice } from '../../hooks/useInvoice';
import { formatCurrency } from '../../utils/currency';
import { Invoice, InvoiceStatus } from '../../types/invoice';

const Invoices: React.FC = React.memo(() => {
  // State management
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [filter, setFilter] = useState({
    status: undefined as InvoiceStatus | undefined,
    dateFrom: '',
    dateTo: ''
  });

  // Custom hooks
  const {
    invoices,
    loading,
    errors,
    downloadProgress,
    operations: {
      fetchInvoices,
      generateInvoice,
      downloadInvoice,
      updateStatus
    }
  } = useInvoice();

  // Initial data fetch
  useEffect(() => {
    fetchInvoices(filter);
  }, [fetchInvoices, filter]);

  // Column definitions with accessibility support
  const columns = useMemo(() => [
    {
      field: 'invoiceNumber',
      headerName: 'Invoice #',
      width: 150,
      renderCell: (params: any) => (
        <Tooltip title="View invoice details">
          <span>{params.value}</span>
        </Tooltip>
      )
    },
    {
      field: 'customerDetails.name',
      headerName: 'Customer',
      width: 200,
      valueGetter: (params: any) => params.row.customerDetails?.name
    },
    {
      field: 'issueDate',
      headerName: 'Issue Date',
      width: 150,
      type: 'date'
    },
    {
      field: 'dueDate',
      headerName: 'Due Date',
      width: 150,
      type: 'date'
    },
    {
      field: 'totalAmount',
      headerName: 'Amount',
      width: 150,
      renderCell: (params: any) => (
        <span>
          {formatCurrency(params.value, params.row.currencyCode)}
        </span>
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params: any) => (
        <Badge
          color={
            params.value === InvoiceStatus.PAID ? 'success' :
            params.value === InvoiceStatus.OVERDUE ? 'error' :
            'warning'
          }
          badgeContent={params.value}
        />
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params: any) => (
        <Stack direction="row" spacing={1}>
          <Tooltip title="Download Invoice">
            <span>
              <Download
                onClick={() => handleDownload(params.row.id)}
                aria-label="Download invoice"
                role="button"
                style={{ cursor: 'pointer' }}
              />
            </span>
          </Tooltip>
          <Tooltip title="Print Invoice">
            <span>
              <Print
                onClick={() => handlePrint(params.row.id)}
                aria-label="Print invoice"
                role="button"
                style={{ cursor: 'pointer' }}
              />
            </span>
          </Tooltip>
          <Tooltip title="Edit Invoice">
            <span>
              <Edit
                onClick={() => handleEdit(params.row.id)}
                aria-label="Edit invoice"
                role="button"
                style={{ cursor: 'pointer' }}
              />
            </span>
          </Tooltip>
        </Stack>
      )
    }
  ], []);

  // Event handlers
  const handleGenerateInvoice = useCallback(async (invoiceData: any) => {
    try {
      await generateInvoice(invoiceData);
      setIsGeneratorOpen(false);
      // Refresh invoice list
      fetchInvoices(filter);
    } catch (error) {
      console.error('Failed to generate invoice:', error);
    }
  }, [generateInvoice, fetchInvoices, filter]);

  const handleDownload = useCallback(async (invoiceId: string) => {
    try {
      const blob = await downloadInvoice(invoiceId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to download invoice:', error);
    }
  }, [downloadInvoice]);

  const handlePrint = useCallback((invoiceId: string) => {
    // Implement print functionality
    window.print();
  }, []);

  const handleEdit = useCallback((invoiceId: string) => {
    // Implement edit functionality
    console.log('Edit invoice:', invoiceId);
  }, []);

  const handleSelectionChange = useCallback((newSelection: any) => {
    setSelectedRows(newSelection);
  }, []);

  return (
    <Box>
      <PageHeader
        title="Invoices"
        subtitle="Manage and generate customer invoices"
        actions={[
          <Tooltip title="Generate new invoice" key="generate">
            <span>
              <Button
                startIcon={<AddIcon />}
                onClick={() => setIsGeneratorOpen(true)}
                variant="contained"
                color="primary"
                aria-label="Generate new invoice"
              >
                Generate Invoice
              </Button>
            </span>
          </Tooltip>
        ]}
      />

      <DataGrid
        rows={invoices}
        columns={columns}
        loading={loading.fetch}
        error={errors.fetch}
        selection
        onSelectionChange={handleSelectionChange}
        title="Invoice List"
        exportOptions={{
          formats: ['csv', 'pdf'],
          filename: 'invoices-export'
        }}
      />

      <Dialog
        open={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        maxWidth="md"
        fullWidth
        aria-labelledby="invoice-generator-dialog"
      >
        <DialogTitle id="invoice-generator-dialog">
          Generate New Invoice
        </DialogTitle>
        <DialogContent>
          <InvoiceGenerator
            onSuccess={handleGenerateInvoice}
            onError={(error) => console.error('Invoice generation error:', error)}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setIsGeneratorOpen(false)}
            color="primary"
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

// Display name for debugging
Invoices.displayName = 'Invoices';

export default Invoices;