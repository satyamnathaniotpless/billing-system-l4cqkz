import React from 'react';
import {
  Typography,
  Box,
  Stack,
  Breadcrumbs,
  Link,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { styled } from '@mui/material/styles';
import Button from './Button';

/**
 * Props interface for PageHeader component
 */
interface PageHeaderProps {
  /** Main header title text */
  title: string;
  /** Optional subtitle text displayed below title */
  subtitle?: string;
  /** Optional array of action buttons or elements */
  actions?: React.ReactNode[];
  /** Optional breadcrumb navigation items */
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
}

/**
 * Styled container component for page header using MUI styled API
 * Implements Material Design 3.0 principles with 8px grid system
 */
const StyledHeader = styled(Box)(({ theme }) => ({
  width: '100%',
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
  boxShadow: theme.shadows[1],
  transition: theme.transitions.create(['padding', 'background-color', 'border-color'], {
    duration: theme.transitions.duration.standard,
  }),
  
  // Responsive padding based on breakpoints
  padding: theme.spacing(2),
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(2, 3),
  },
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(3, 4),
  },
  
  // Ensure proper spacing for content
  '& > .MuiStack-root': {
    gap: theme.spacing(2),
  },
}));

/**
 * PageHeader component providing consistent header styling and layout
 * Implements Material Design 3.0 principles with responsive design
 * 
 * @component
 * @example
 * // Basic usage
 * <PageHeader title="Dashboard" />
 * 
 * // With all features
 * <PageHeader
 *   title="Customers"
 *   subtitle="Manage customer accounts"
 *   breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Customers' }]}
 *   actions={[<Button>Add Customer</Button>]}
 * />
 */
const PageHeader = React.memo<PageHeaderProps>(({
  title,
  subtitle,
  actions,
  breadcrumbs,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <StyledHeader
      component="header"
      role="banner"
      aria-label={`${title} page header`}
    >
      <Stack
        direction="column"
        spacing={1}
      >
        {/* Breadcrumb Navigation */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs
            aria-label="page navigation"
            sx={{
              '& .MuiBreadcrumbs-separator': {
                mx: 1,
              },
            }}
          >
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return crumb.href && !isLast ? (
                <Link
                  key={crumb.label}
                  href={crumb.href}
                  color="inherit"
                  underline="hover"
                  sx={{ 
                    typography: 'body2',
                    color: 'text.secondary',
                  }}
                >
                  {crumb.label}
                </Link>
              ) : (
                <Typography
                  key={crumb.label}
                  variant="body2"
                  color={isLast ? 'text.primary' : 'text.secondary'}
                >
                  {crumb.label}
                </Typography>
              );
            })}
          </Breadcrumbs>
        )}

        {/* Header Content */}
        <Stack
          direction={isMobile ? 'column' : 'row'}
          justifyContent="space-between"
          alignItems={isMobile ? 'flex-start' : 'center'}
          spacing={2}
        >
          {/* Title and Subtitle */}
          <Box>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 600,
                color: 'text.primary',
                mb: subtitle ? 0.5 : 0,
              }}
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ maxWidth: '600px' }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>

          {/* Action Buttons */}
          {actions && actions.length > 0 && (
            <Stack
              direction="row"
              spacing={1}
              sx={{
                flexShrink: 0,
                alignSelf: isMobile ? 'stretch' : 'center',
              }}
            >
              {actions.map((action, index) => (
                <Box key={index}>{action}</Box>
              ))}
            </Stack>
          )}
        </Stack>
      </Stack>
    </StyledHeader>
  );
});

// Display name for debugging
PageHeader.displayName = 'PageHeader';

export default PageHeader;