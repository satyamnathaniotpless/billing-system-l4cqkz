// @version: react@18.0.0
// @version: @mui/material@5.0.0
// @version: react-hook-form@7.0.0
// @version: yup@1.0.0

import React, { useCallback, useEffect, useMemo } from 'react';
import { Grid, Button, Box, Typography, CircularProgress } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import * as yup from 'yup';
import { Customer, CustomerType, CustomerStatus } from '../../types/customer';
import CustomTextField from '../common/TextField';
import Select from '../common/Select';

// Form validation schema using yup
const validationSchema = yup.object().shape({
  name: yup
    .string()
    .required('Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  email: yup
    .string()
    .required('Email is required')
    .email('Invalid email format')
    .max(254, 'Email must not exceed 254 characters'),
  phone: yup
    .string()
    .required('Phone number is required')
    .matches(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format'),
  type: yup
    .string()
    .required('Customer type is required')
    .oneOf(Object.values(CustomerType), 'Invalid customer type'),
  status: yup
    .string()
    .required('Status is required')
    .oneOf(Object.values(CustomerStatus), 'Invalid status'),
  metadata: yup.object().nullable()
});

// Props interface for the CustomerForm component
interface CustomerFormProps {
  initialData?: Partial<Customer>;
  onSubmit: (data: Customer) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  validationMode?: 'onBlur' | 'onChange' | 'onSubmit';
}

const CustomerForm: React.FC<CustomerFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  validationMode = 'onBlur'
}) => {
  // Initialize form with react-hook-form
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting }
  } = useForm<Customer>({
    defaultValues: {
      name: initialData?.name || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      type: initialData?.type || CustomerType.INDIVIDUAL,
      status: initialData?.status || CustomerStatus.ACTIVE,
      metadata: initialData?.metadata || {}
    },
    mode: validationMode,
    resolver: yup.object().shape(validationSchema)
  });

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      reset(initialData);
    }
  }, [initialData, reset]);

  // Memoized customer type options
  const customerTypeOptions = useMemo(() => 
    Object.values(CustomerType).map(type => ({
      value: type,
      label: type.charAt(0) + type.slice(1).toLowerCase().replace('_', ' ')
    })),
    []
  );

  // Memoized customer status options
  const customerStatusOptions = useMemo(() => 
    Object.values(CustomerStatus).map(status => ({
      value: status,
      label: status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ')
    })),
    []
  );

  // Form submission handler
  const onFormSubmit = useCallback(async (data: Customer) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Form submission error:', error);
      // Error handling could be enhanced based on requirements
    }
  }, [onSubmit]);

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onFormSubmit)}
      noValidate
      aria-label="Customer form"
    >
      <Grid container spacing={3}>
        {/* Form title */}
        <Grid item xs={12}>
          <Typography variant="h6" component="h2">
            {initialData?.id ? 'Edit Customer' : 'Create New Customer'}
          </Typography>
        </Grid>

        {/* Name field */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <CustomTextField
                {...field}
                label="Name"
                required
                fullWidth
                error={!!errors.name}
                helperText={errors.name?.message}
                disabled={isLoading}
                inputProps={{
                  'aria-label': 'Customer name',
                  maxLength: 100
                }}
              />
            )}
          />
        </Grid>

        {/* Email field */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <CustomTextField
                {...field}
                label="Email"
                required
                fullWidth
                inputType="email"
                error={!!errors.email}
                helperText={errors.email?.message}
                disabled={isLoading}
                inputProps={{
                  'aria-label': 'Customer email',
                  maxLength: 254
                }}
              />
            )}
          />
        </Grid>

        {/* Phone field */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <CustomTextField
                {...field}
                label="Phone"
                required
                fullWidth
                inputType="phone"
                error={!!errors.phone}
                helperText={errors.phone?.message}
                disabled={isLoading}
                inputProps={{
                  'aria-label': 'Customer phone number'
                }}
              />
            )}
          />
        </Grid>

        {/* Customer type field */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                name="type"
                label="Customer Type"
                required
                options={customerTypeOptions}
                error={errors.type?.message}
                disabled={isLoading}
                fullWidth
              />
            )}
          />
        </Grid>

        {/* Status field */}
        <Grid item xs={12} sm={6}>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                name="status"
                label="Status"
                required
                options={customerStatusOptions}
                error={errors.status?.message}
                disabled={isLoading}
                fullWidth
              />
            )}
          />
        </Grid>

        {/* Form actions */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              aria-label="Cancel form"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={!isDirty || isLoading || isSubmitting}
              aria-label="Submit form"
              endIcon={isLoading && <CircularProgress size={20} />}
            >
              {initialData?.id ? 'Update' : 'Create'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CustomerForm;