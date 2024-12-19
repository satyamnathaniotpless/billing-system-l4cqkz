import React from 'react'; // ^18.0.0
import { Card as MuiCard, CardProps as MuiCardProps } from '@mui/material'; // ^5.0.0
import { CardContent } from '@mui/material'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0

// Interface extending MUI CardProps with additional custom properties
export interface CardProps extends Omit<MuiCardProps, 'elevation' | 'variant'> {
  /**
   * Controls card elevation following Material Design principles
   * @default 1
   */
  elevation?: 1 | 2 | 3;
  
  /**
   * Determines card border and shadow styling
   * @default 'elevation'
   */
  variant?: 'outlined' | 'elevation';
  
  /**
   * Controls internal padding following 8px grid system
   * @default 'normal'
   */
  padding?: 'none' | 'normal' | 'large';
  
  /**
   * Card content elements
   */
  children: React.ReactNode;
  
  /**
   * Additional CSS classes for external styling
   */
  className?: string;
}

// Styled MUI Card component with custom theme integration
const StyledCard = styled(MuiCard, {
  shouldForwardProp: (prop) => !['padding'].includes(prop as string),
})<CardProps>(({ theme, elevation = 1, variant = 'elevation', padding = 'normal' }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  transition: theme.transitions.create(['box-shadow', 'transform'], {
    duration: theme.transitions.duration.shorter,
  }),
  backgroundColor: theme.palette.background.paper,
  
  // Elevation-specific shadows
  ...(variant === 'elevation' && {
    boxShadow: {
      1: theme.shadows[1],
      2: theme.shadows[2],
      3: theme.shadows[4],
    }[elevation],
    
    '&:hover': {
      transform: elevation > 1 ? 'translateY(-2px)' : 'none',
      boxShadow: theme.shadows[elevation + 1],
    },
  }),
  
  // Outlined variant styles
  ...(variant === 'outlined' && {
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: 'none',
  }),
  
  // Dark mode specific adjustments
  ...(theme.palette.mode === 'dark' && {
    backgroundColor: theme.palette.grey[900],
    ...(variant === 'outlined' && {
      borderColor: theme.palette.grey[800],
    }),
  }),
  
  // Padding based on 8px grid system
  '& .MuiCardContent-root': {
    padding: {
      none: 0,
      normal: theme.spacing(2), // 16px
      large: theme.spacing(3), // 24px
    }[padding],
  },
}));

/**
 * A reusable card component following Material Design 3.0 principles.
 * Provides a surface container for content with consistent elevation, padding, and theming support.
 * 
 * @param {CardProps} props - The component props
 * @returns {JSX.Element} Rendered card component
 */
export const Card = React.memo<CardProps>(({
  children,
  elevation = 1,
  variant = 'elevation',
  padding = 'normal',
  className,
  ...rest
}) => {
  // Ensure valid elevation value
  const validElevation = Math.max(1, Math.min(3, elevation));
  
  return (
    <StyledCard
      elevation={validElevation}
      variant={variant}
      padding={padding}
      className={className}
      role="article"
      aria-level={validElevation}
      {...rest}
    >
      <CardContent>
        {children}
      </CardContent>
    </StyledCard>
  );
});

// Display name for debugging
Card.displayName = 'Card';

export default Card;