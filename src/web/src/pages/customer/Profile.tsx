import React, { useEffect, useState, useCallback } from 'react';
import { 
  Box, 
  Grid, 
  Paper, 
  Alert, 
  Snackbar,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import PageHeader from '../../components/common/PageHeader';
import TextField from '../../components/common/TextField';
import Button from '../../components/common/Button';
import { useCustomer } from '../../hooks/useCustomer';
import { validateEmail, validatePhone } from '../../utils/validation';

// Interface for profile form data with validation rules
interface ProfileFormData {
  companyName: string;
  email: string;
  phone: string;
  address: string;
  gstin: string;
}

// GSTIN validation regex
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const Profile: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { selectedCustomer, updateCustomer, loading, error } = useCustomer();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form initialization with react-hook-form
  const { 
    control, 
    handleSubmit, 
    reset, 
    formState: { errors, isDirty }
  } = useForm<ProfileFormData>({
    defaultValues: {
      companyName: '',
      email: '',
      phone: '',
      address: '',
      gstin: ''
    }
  });

  // Load customer data into form
  useEffect(() => {
    if (selectedCustomer) {
      reset({
        companyName: selectedCustomer.name,
        email: selectedCustomer.email,
        phone: selectedCustomer.phone,
        address: selectedCustomer.metadata?.address || '',
        gstin: selectedCustomer.metadata?.gstin || ''
      });
    }
  }, [selectedCustomer, reset]);

  // Handle form submission
  const onSubmit = useCallback(async (data: ProfileFormData) => {
    try {
      if (!selectedCustomer?.id) return;

      await updateCustomer(selectedCustomer.id, {
        name: data.companyName,
        email: data.email,
        phone: data.phone,
        metadata: {
          address: data.address,
          gstin: data.gstin
        }
      });

      setSuccessMessage('Profile updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  }, [selectedCustomer, updateCustomer]);

  // Handle form cancellation
  const handleCancel = useCallback(() => {
    if (selectedCustomer) {
      reset({
        companyName: selectedCustomer.name,
        email: selectedCustomer.email,
        phone: selectedCustomer.phone,
        address: selectedCustomer.metadata?.address || '',
        gstin: selectedCustomer.metadata?.gstin || ''
      });
    }
  }, [selectedCustomer, reset]);

  return (
    <Box component="main" role="main" aria-label="Customer Profile">
      <PageHeader
        title="Profile"
        subtitle="Manage your company profile and billing information"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Profile' }
        ]}
      />

      <Paper
        elevation={1}
        sx={{
          p: { xs: 2, sm: 3, md: 4 },
          mt: 2,
          mx: 'auto',
          maxWidth: 'lg'
        }}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Grid container spacing={3}>
            {/* Company Name */}
            <Grid item xs={12} md={6}>
              <Controller
                name="companyName"
                control={control}
                rules={{
                  required: 'Company name is required',
                  minLength: {
                    value: 2,
                    message: 'Company name must be at least 2 characters'
                  },
                  maxLength: {
                    value: 100,
                    message: 'Company name cannot exceed 100 characters'
                  }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Company Name"
                    required
                    error={!!errors.companyName}
                    helperText={errors.companyName?.message}
                    fullWidth
                    inputProps={{
                      'aria-label': 'Company name',
                      'aria-required': 'true'
                    }}
                  />
                )}
              />
            </Grid>

            {/* Email */}
            <Grid item xs={12} md={6}>
              <Controller
                name="email"
                control={control}
                rules={{
                  required: 'Email is required',
                  validate: (value) => {
                    const result = validateEmail(value);
                    return result.isValid || result.errors[0];
                  }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Email"
                    required
                    inputType="email"
                    error={!!errors.email}
                    helperText={errors.email?.message}
                    fullWidth
                    inputProps={{
                      'aria-label': 'Email address',
                      'aria-required': 'true'
                    }}
                  />
                )}
              />
            </Grid>

            {/* Phone */}
            <Grid item xs={12} md={6}>
              <Controller
                name="phone"
                control={control}
                rules={{
                  validate: (value) => {
                    if (!value) return true;
                    const result = validatePhone(value, 'IN');
                    return result.isValid || result.errors[0];
                  }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Phone"
                    inputType="phone"
                    error={!!errors.phone}
                    helperText={errors.phone?.message}
                    fullWidth
                    inputProps={{
                      'aria-label': 'Phone number'
                    }}
                  />
                )}
              />
            </Grid>

            {/* GSTIN */}
            <Grid item xs={12} md={6}>
              <Controller
                name="gstin"
                control={control}
                rules={{
                  pattern: {
                    value: GSTIN_REGEX,
                    message: 'Invalid GSTIN format'
                  }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="GSTIN"
                    error={!!errors.gstin}
                    helperText={errors.gstin?.message}
                    fullWidth
                    inputProps={{
                      'aria-label': 'GSTIN number'
                    }}
                  />
                )}
              />
            </Grid>

            {/* Address */}
            <Grid item xs={12}>
              <Controller
                name="address"
                control={control}
                rules={{
                  required: 'Address is required',
                  maxLength: {
                    value: 500,
                    message: 'Address cannot exceed 500 characters'
                  }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Address"
                    required
                    multiline
                    rows={3}
                    error={!!errors.address}
                    helperText={errors.address?.message}
                    fullWidth
                    inputProps={{
                      'aria-label': 'Company address',
                      'aria-required': 'true'
                    }}
                  />
                )}
              />
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  flexDirection: isMobile ? 'column' : 'row',
                  justifyContent: 'flex-end'
                }}
              >
                <Button
                  variant="outlined"
                  onClick={handleCancel}
                  disabled={loading}
                  fullWidth={isMobile}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  loading={loading}
                  disabled={!isDirty}
                  fullWidth={isMobile}
                >
                  Save Changes
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>

      {/* Success Message */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage(null)}
      >
        <Alert severity="success" variant="filled">
          {successMessage}
        </Alert>
      </Snackbar>

      {/* Error Message */}
      <Snackbar
        open={!!error?.customers}
        autoHideDuration={5000}
      >
        <Alert severity="error" variant="filled">
          {error?.customers}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Profile;