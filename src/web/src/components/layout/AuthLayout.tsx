import React from 'react'; // ^18.0.0
import { Box, Container, Stack, Typography, CircularProgress } from '@mui/material'; // ^5.0.0
import { Footer } from './Footer';
import { Card } from '../common/Card';
import logo from '../../assets/images/logo.svg';

/**
 * Props interface for the AuthLayout component
 */
interface AuthLayoutProps {
  /** Auth form content */
  children: React.ReactNode;
  /** Page title for accessibility */
  title: string;
  /** Container max width */
  maxWidth?: 'xs' | 'sm' | 'md';
  /** Card elevation level */
  elevation?: 1 | 2 | 3;
  /** Custom spacing multiplier */
  spacing?: number;
  /** Loading state indicator */
  loading?: boolean;
}

/**
 * Enhanced layout component for authentication pages with accessibility and responsive features.
 * Implements Material Design 3.0 principles with proper elevation system and 8px grid.
 * 
 * @version 1.0.0
 */
const AuthLayout = React.memo<AuthLayoutProps>(({
  children,
  title,
  maxWidth = 'sm',
  elevation = 2,
  spacing = 3,
  loading = false
}) => {
  return (
    <Box
      component="main"
      role="main"
      aria-labelledby="auth-title"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-background)',
        transition: 'background-color var(--transition-duration-normal) var(--transition-timing)'
      }}
    >
      <Container 
        maxWidth={maxWidth}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: { xs: 2, sm: 3, md: 4 },
          py: { xs: 3, sm: 4, md: 6 }
        }}
      >
        {/* Logo and Title Section */}
        <Stack
          spacing={spacing}
          alignItems="center"
          sx={{ mb: { xs: 3, sm: 4 } }}
        >
          <Box
            component="img"
            src={logo}
            alt=""
            aria-hidden="true"
            sx={{
              width: { xs: '120px', sm: '160px', md: '200px' },
              height: 'auto',
              color: 'var(--color-primary)',
              transition: 'width var(--transition-duration-normal) var(--transition-timing)'
            }}
          />
          
          <Typography
            id="auth-title"
            variant="h1"
            align="center"
            sx={{
              fontSize: { xs: 'var(--font-size-2xl)', sm: 'var(--font-size-3xl)' },
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              letterSpacing: 'var(--letter-spacing-tight)'
            }}
          >
            {title}
          </Typography>
        </Stack>

        {/* Main Content Card */}
        <Card
          elevation={elevation}
          padding="large"
          sx={{
            width: '100%',
            maxWidth: { xs: '100%', sm: '480px' },
            mx: 'auto',
            position: 'relative'
          }}
        >
          {loading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '200px'
              }}
            >
              <CircularProgress
                size={40}
                thickness={4}
                aria-label="Loading..."
                sx={{ color: 'var(--color-primary)' }}
              />
            </Box>
          ) : children}
        </Card>
      </Container>

      <Footer />
    </Box>
  );
});

// Display name for debugging
AuthLayout.displayName = 'AuthLayout';

export default AuthLayout;