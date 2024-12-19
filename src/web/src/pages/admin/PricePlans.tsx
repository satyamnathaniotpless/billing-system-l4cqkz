import React, { useEffect, useState, useCallback } from 'react';
import { 
  Grid, 
  Button, 
  Dialog, 
  CircularProgress, 
  Alert,
  Box,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';

import PageHeader from '../../components/common/PageHeader';
import PricePlanCard from '../../components/billing/PricePlanCard';
import { useBilling } from '../../hooks/useBilling';
import type { PricePlan } from '../../types/billing';

// Styled components
const StyledGrid = styled(Grid)(({ theme }) => ({
  padding: theme.spacing(3),
  gap: theme.spacing(3),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
    gap: theme.spacing(2),
  }
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '400px',
  width: '100%'
}));

// Interface for dialog props
interface PricePlanDialogProps {
  open: boolean;
  onClose: () => void;
  plan: PricePlan | null;
  onSubmit: (data: PricePlan) => Promise<void>;
}

/**
 * Price Plans admin page component
 * Provides functionality to view, create, edit and manage pricing tiers
 */
const PricePlans = React.memo(() => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { t } = useTranslation();
  
  // Local state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PricePlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get billing hook functionality
  const { 
    pricePlans, 
    loading, 
    fetchPricePlans, 
    createPricePlan, 
    updatePricePlan 
  } = useBilling();

  // Fetch price plans on component mount
  useEffect(() => {
    const loadPlans = async () => {
      try {
        await fetchPricePlans();
        setError(null);
      } catch (err) {
        setError(t('errors.fetchPricePlans'));
      }
    };
    loadPlans();
  }, [fetchPricePlans, t]);

  // Dialog handlers
  const handleOpenDialog = useCallback((plan: PricePlan | null = null) => {
    setSelectedPlan(plan);
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setSelectedPlan(null);
    setDialogOpen(false);
  }, []);

  // Handle plan creation/update
  const handleSubmitPlan = useCallback(async (planData: PricePlan) => {
    try {
      if (selectedPlan) {
        await updatePricePlan({ ...selectedPlan, ...planData });
      } else {
        await createPricePlan(planData);
      }
      handleCloseDialog();
      await fetchPricePlans(); // Refresh the list
      setError(null);
    } catch (err) {
      setError(t('errors.savePricePlan'));
    }
  }, [selectedPlan, updatePricePlan, createPricePlan, fetchPricePlans, handleCloseDialog, t]);

  // Render loading state
  if (loading && !pricePlans.length) {
    return (
      <LoadingContainer>
        <CircularProgress 
          size={40} 
          aria-label={t('common.loading')}
        />
      </LoadingContainer>
    );
  }

  return (
    <>
      <PageHeader
        title={t('pricePlans.title')}
        subtitle={t('pricePlans.subtitle')}
        actions={[
          <Button
            key="create-plan"
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog(null)}
            size={isMobile ? "medium" : "large"}
          >
            {t('pricePlans.createNew')}
          </Button>
        ]}
      />

      {error && (
        <Box sx={{ p: 2 }}>
          <Alert 
            severity="error" 
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        </Box>
      )}

      <StyledGrid 
        container 
        spacing={3}
        component="section"
        aria-label={t('pricePlans.gridLabel')}
      >
        {pricePlans.map((plan) => (
          <Grid 
            item 
            xs={12} 
            sm={6} 
            md={4} 
            lg={3} 
            key={plan.id}
          >
            <PricePlanCard
              plan={plan}
              onSelect={() => handleOpenDialog(plan)}
              aria-label={`${plan.name} ${t('pricePlans.cardLabel')}`}
            />
          </Grid>
        ))}
      </StyledGrid>

      {/* Price Plan Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        aria-labelledby="price-plan-dialog-title"
      >
        {/* Dialog content will be implemented in a separate PricePlanDialog component */}
        {/* This is a placeholder for the actual form implementation */}
      </Dialog>
    </>
  );
});

// Display name for debugging
PricePlans.displayName = 'PricePlans';

export default PricePlans;