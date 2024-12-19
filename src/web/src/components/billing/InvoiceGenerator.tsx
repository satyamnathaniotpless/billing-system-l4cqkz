import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  TextField,
  Select,
  MenuItem,
  Grid,
  Paper,
  IconButton,
  Typography,
  Tooltip,
  Alert,
  FormHelperText,
  InputAdornment,
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useDebounce } from 'use-debounce';
import * as yup from 'yup';

import { useInvoice } from '../../hooks/useInvoice';
import Button from '../common/Button';
import {
  Invoice,
  LineItem,
  TaxType,
  CurrencyCode,
  SUPPORTED_CURRENCIES,
  TAX_RATES,
  isValidInvoiceDate
} from '../../types/invoice';

// Validation schema for line items
const lineItemSchema = yup.object().shape({
  serviceName: yup.string().required('Service name is required'),
  description: yup.string().required('Description is required'),
  quantity: yup.number().positive('Quantity must be positive').required('Quantity is required'),
  unitPrice: yup.number().min(0, 'Unit price cannot be negative').required('Unit price is required'),
  currencyCode: yup.string().oneOf(SUPPORTED_CURRENCIES, 'Invalid currency').required('Currency is required')
});

// Validation schema for invoice
const invoiceSchema = yup.object().shape({
  issueDate: yup.date().required('Issue date is required'),
  dueDate: yup.date().min(yup.ref('issueDate'), 'Due date must be after issue date').required('Due date is required'),
  taxType: yup.string().oneOf(Object.values(TaxType), 'Invalid tax type').required('Tax type is required'),
  lineItems: yup.array().of(lineItemSchema).min(1, 'At least one line item is required')
});

interface InvoiceGeneratorProps {
  customerId: string;
  onSuccess?: (invoice: Invoice) => void;
  onError?: (error: Error) => void;
  initialData?: Partial<Invoice>;
  currency?: CurrencyCode;
}

const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = React.memo(({
  customerId,
  onSuccess,
  onError,
  initialData,
  currency = 'USD'
}) => {
  // State management
  const [formData, setFormData] = useState({
    issueDate: initialData?.issueDate || new Date().toISOString(),
    dueDate: initialData?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    taxType: initialData?.taxType || TaxType.GST,
    notes: initialData?.notes || ''
  });

  const [lineItems, setLineItems] = useState<Partial<LineItem>[]>(
    initialData?.lineItems || [{
      serviceName: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      currencyCode: currency
    }]
  );

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totals, setTotals] = useState({ subtotal: 0, tax: 0, total: 0 });

  // Custom hooks
  const { operations } = useInvoice();
  const [debouncedLineItems] = useDebounce(lineItems, 500);

  // Calculate totals when line items change
  useEffect(() => {
    const subtotal = debouncedLineItems.reduce((sum, item) => 
      sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
    const tax = subtotal * TAX_RATES[formData.taxType];
    setTotals({
      subtotal,
      tax,
      total: subtotal + tax
    });
  }, [debouncedLineItems, formData.taxType]);

  // Handle line item changes
  const handleLineItemChange = useCallback((index: number, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  }, []);

  // Add new line item
  const handleAddLineItem = useCallback(() => {
    setLineItems(prev => [...prev, {
      serviceName: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      currencyCode: currency
    }]);
  }, [currency]);

  // Remove line item
  const handleRemoveLineItem = useCallback((index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setValidationErrors({});

    try {
      // Validate form data
      await invoiceSchema.validate({
        ...formData,
        lineItems
      }, { abortEarly: false });

      // Generate invoice
      const invoice = await operations.generateInvoice({
        customerId,
        ...formData,
        lineItems: lineItems as LineItem[],
        currencyCode: currency
      });

      onSuccess?.(invoice);
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const errors: Record<string, string> = {};
        error.inner.forEach(err => {
          if (err.path) errors[err.path] = err.message;
        });
        setValidationErrors(errors);
      }
      onError?.(error as Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render line items
  const renderLineItems = useMemo(() => lineItems.map((item, index) => (
    <Grid container spacing={2} key={index} alignItems="center">
      <Grid item xs={12} sm={3}>
        <TextField
          label="Service Name"
          value={item.serviceName}
          onChange={(e) => handleLineItemChange(index, 'serviceName', e.target.value)}
          error={!!validationErrors[`lineItems.${index}.serviceName`]}
          helperText={validationErrors[`lineItems.${index}.serviceName`]}
          fullWidth
          required
        />
      </Grid>
      <Grid item xs={12} sm={3}>
        <TextField
          label="Description"
          value={item.description}
          onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
          error={!!validationErrors[`lineItems.${index}.description`]}
          helperText={validationErrors[`lineItems.${index}.description`]}
          fullWidth
          required
        />
      </Grid>
      <Grid item xs={6} sm={2}>
        <TextField
          label="Quantity"
          type="number"
          value={item.quantity}
          onChange={(e) => handleLineItemChange(index, 'quantity', Number(e.target.value))}
          error={!!validationErrors[`lineItems.${index}.quantity`]}
          helperText={validationErrors[`lineItems.${index}.quantity`]}
          fullWidth
          required
        />
      </Grid>
      <Grid item xs={6} sm={2}>
        <TextField
          label="Unit Price"
          type="number"
          value={item.unitPrice}
          onChange={(e) => handleLineItemChange(index, 'unitPrice', Number(e.target.value))}
          error={!!validationErrors[`lineItems.${index}.unitPrice`]}
          helperText={validationErrors[`lineItems.${index}.unitPrice`]}
          InputProps={{
            startAdornment: <InputAdornment position="start">{currency}</InputAdornment>
          }}
          fullWidth
          required
        />
      </Grid>
      <Grid item xs={12} sm={2}>
        <Tooltip title="Remove Line Item">
          <IconButton
            onClick={() => handleRemoveLineItem(index)}
            disabled={lineItems.length === 1}
            aria-label="Remove line item"
          >
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Grid>
    </Grid>
  )), [lineItems, currency, validationErrors, handleLineItemChange, handleRemoveLineItem]);

  return (
    <Paper elevation={1} className="p-4">
      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Date Selection */}
          <Grid item xs={12} sm={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Issue Date"
                value={new Date(formData.issueDate)}
                onChange={(date) => setFormData(prev => ({
                  ...prev,
                  issueDate: date?.toISOString() || new Date().toISOString()
                }))}
                slotProps={{
                  textField: {
                    error: !!validationErrors.issueDate,
                    helperText: validationErrors.issueDate
                  }
                }}
              />
            </LocalizationProvider>
          </Grid>
          <Grid item xs={12} sm={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Due Date"
                value={new Date(formData.dueDate)}
                onChange={(date) => setFormData(prev => ({
                  ...prev,
                  dueDate: date?.toISOString() || new Date().toISOString()
                }))}
                slotProps={{
                  textField: {
                    error: !!validationErrors.dueDate,
                    helperText: validationErrors.dueDate
                  }
                }}
              />
            </LocalizationProvider>
          </Grid>

          {/* Tax Type Selection */}
          <Grid item xs={12} sm={6}>
            <Select
              value={formData.taxType}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                taxType: e.target.value as TaxType
              }))}
              fullWidth
              error={!!validationErrors.taxType}
            >
              {Object.values(TaxType).map(type => (
                <MenuItem key={type} value={type}>
                  {type} ({(TAX_RATES[type] * 100).toFixed(0)}%)
                </MenuItem>
              ))}
            </Select>
            {validationErrors.taxType && (
              <FormHelperText error>{validationErrors.taxType}</FormHelperText>
            )}
          </Grid>

          {/* Line Items */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Line Items
            </Typography>
            {renderLineItems}
            <Button
              startIcon={<AddIcon />}
              onClick={handleAddLineItem}
              variant="outlined"
              className="mt-3"
            >
              Add Line Item
            </Button>
          </Grid>

          {/* Totals */}
          <Grid item xs={12}>
            <Grid container spacing={2} justifyContent="flex-end">
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle1">
                  Subtotal: {currency} {totals.subtotal.toFixed(2)}
                </Typography>
                <Typography variant="subtitle1">
                  Tax ({(TAX_RATES[formData.taxType] * 100).toFixed(0)}%): {currency} {totals.tax.toFixed(2)}
                </Typography>
                <Typography variant="h6">
                  Total: {currency} {totals.total.toFixed(2)}
                </Typography>
              </Grid>
            </Grid>
          </Grid>

          {/* Notes */}
          <Grid item xs={12}>
            <TextField
              label="Notes"
              multiline
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              fullWidth
            />
          </Grid>

          {/* Submit Button */}
          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              loading={isSubmitting}
              fullWidth
            >
              Generate Invoice
            </Button>
          </Grid>
        </Grid>
      </form>
    </Paper>
  );
});

InvoiceGenerator.displayName = 'InvoiceGenerator';

export default InvoiceGenerator;