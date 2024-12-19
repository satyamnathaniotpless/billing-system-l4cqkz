import React from 'react'; // ^18.0.0
import { Typography, useMediaQuery } from '@mui/material'; // ^5.0.0
import { styled, useTheme } from '@mui/material/styles'; // ^5.0.0
import Card from '../common/Card';
import Button from '../common/Button';
import type { PricePlan } from '../../types/billing';

/**
 * Interface for custom contract terms
 */
interface CustomTerms {
  title: string;
  description: string;
  validityPeriod?: string;
}

/**
 * Props interface for the PricePlanCard component
 */
interface PricePlanCardProps {
  plan: PricePlan;
  isSelected?: boolean;
  onSelect?: (planId: string) => void;
  className?: string;
  customTerms?: CustomTerms;
}

/**
 * Styled wrapper for the price plan card with theme integration
 */
const StyledPricePlanCard = styled(Card, {
  shouldForwardProp: (prop) => !['isSelected'].includes(prop as string),
})<{ isSelected?: boolean }>(({ theme, isSelected }) => ({
  position: 'relative',
  width: '100%',
  maxWidth: '400px',
  transition: theme.transitions.create(
    ['transform', 'box-shadow', 'border-color'],
    { duration: theme.transitions.duration.shorter }
  ),
  
  // Selected state styles
  ...(isSelected && {
    borderColor: theme.palette.primary.main,
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[4],
    
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '4px',
      backgroundColor: theme.palette.primary.main,
      borderTopLeftRadius: theme.shape.borderRadius,
      borderTopRightRadius: theme.shape.borderRadius,
    },
  }),

  // Hover state
  '&:hover': {
    transform: isSelected ? 'translateY(-4px)' : 'translateY(-2px)',
    boxShadow: theme.shadows[isSelected ? 4 : 2],
  },

  // Dark mode adjustments
  ...(theme.palette.mode === 'dark' && {
    backgroundColor: theme.palette.grey[900],
    borderColor: isSelected ? theme.palette.primary.main : theme.palette.grey[800],
  }),

  // Focus visible styles for accessibility
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

/**
 * Formats currency values with proper localization
 */
const formatCurrency = (amount: number, currency: string, locale = 'en-US'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * PricePlanCard component for displaying pricing information
 */
const PricePlanCard = React.memo<PricePlanCardProps>(({
  plan,
  isSelected = false,
  onSelect,
  className,
  customTerms,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Memoized currency formatter
  const formattedBasePrice = React.useMemo(() => 
    formatCurrency(plan.basePrice, plan.currency),
    [plan.basePrice, plan.currency]
  );

  // Handle plan selection
  const handleSelect = React.useCallback(() => {
    if (onSelect) {
      onSelect(plan.id);
    }
  }, [onSelect, plan.id]);

  return (
    <StyledPricePlanCard
      isSelected={isSelected}
      className={className}
      elevation={isSelected ? 2 : 1}
      role="article"
      aria-selected={isSelected}
    >
      {/* Plan Header */}
      <Typography
        variant="h5"
        component="h2"
        gutterBottom
        color="primary"
        sx={{ mb: 2 }}
      >
        {plan.name}
      </Typography>

      {/* Plan Price */}
      <Typography
        variant="h4"
        component="div"
        sx={{ mb: 1 }}
        aria-label={`Base price ${formattedBasePrice}`}
      >
        {formattedBasePrice}
        <Typography
          component="span"
          variant="subtitle1"
          color="text.secondary"
          sx={{ ml: 1 }}
        >
          /{plan.billingFrequency.toLowerCase()}
        </Typography>
      </Typography>

      {/* Plan Description */}
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 3 }}
      >
        {plan.description}
      </Typography>

      {/* Included Usage */}
      <Typography variant="body2" sx={{ mb: 2 }}>
        Includes {plan.includedUsage.toLocaleString()} requests
      </Typography>

      {/* Price Components */}
      {plan.priceComponents.map((component) => (
        <Typography
          key={component.id}
          variant="body2"
          color="text.secondary"
          sx={{ mb: 1 }}
        >
          {formatCurrency(component.unitPrice, plan.currency)} per request
          {' '}({component.usageFrom.toLocaleString()} - {component.usageTo.toLocaleString()})
        </Typography>
      ))}

      {/* Custom Terms if present */}
      {customTerms && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 2, mb: 2 }}
        >
          {customTerms.description}
          {customTerms.validityPeriod && (
            <Typography
              component="span"
              variant="caption"
              display="block"
              sx={{ mt: 1 }}
            >
              Valid until: {customTerms.validityPeriod}
            </Typography>
          )}
        </Typography>
      )}

      {/* Action Button */}
      <Button
        variant="contained"
        color="primary"
        fullWidth
        size={isMobile ? "medium" : "large"}
        onClick={handleSelect}
        disabled={!plan.active}
        sx={{ mt: 3 }}
        aria-label={`Select ${plan.name} plan`}
      >
        {isSelected ? 'Current Plan' : 'Select Plan'}
      </Button>

      {/* Validity Period */}
      <Typography
        variant="caption"
        color="text.secondary"
        align="center"
        sx={{ mt: 2, display: 'block' }}
      >
        Valid from {new Date(plan.validFrom).toLocaleDateString()} to{' '}
        {new Date(plan.validUntil).toLocaleDateString()}
      </Typography>
    </StyledPricePlanCard>
  );
});

// Display name for debugging
PricePlanCard.displayName = 'PricePlanCard';

export default PricePlanCard;

// Named exports
export type { PricePlanCardProps, CustomTerms };