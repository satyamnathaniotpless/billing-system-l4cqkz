import React from 'react';
import { Box, Container, Typography, Link, Stack } from '@mui/material';
import '../../assets/styles/global.css';
import '../../assets/styles/theme.css';

/**
 * Footer component for the OTPless Internal Billing System
 * Implements WCAG 2.1 Level AA compliance with proper semantic structure,
 * keyboard navigation, and responsive design
 * 
 * @version 1.0.0
 * @returns {JSX.Element} Accessible and responsive footer component
 */
const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  // Footer links configuration with proper accessibility attributes
  const footerLinks = [
    {
      label: 'Privacy Policy',
      href: '/privacy',
      ariaLabel: 'View Privacy Policy'
    },
    {
      label: 'Terms of Service',
      href: '/terms',
      ariaLabel: 'View Terms of Service'
    },
    {
      label: 'Contact Support',
      href: '/support',
      ariaLabel: 'Contact Customer Support'
    }
  ];

  return (
    <Box
      component="footer"
      role="contentinfo"
      sx={{
        borderTop: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        mt: 'auto', // Ensures footer sticks to bottom
        py: { xs: 2, sm: 3 }, // Responsive padding
        transition: 'background-color var(--transition-duration-normal) var(--transition-timing)'
      }}
    >
      <Container 
        maxWidth="lg"
        sx={{
          px: { xs: 2, sm: 3 } // Responsive horizontal padding
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 2, sm: 3 }}
          justifyContent="space-between"
          alignItems={{ xs: 'center', sm: 'flex-start' }}
        >
          {/* Copyright section with semantic markup */}
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              textAlign: { xs: 'center', sm: 'left' },
              color: 'var(--color-text-secondary)'
            }}
          >
            © {currentYear} OTPless. All rights reserved.
          </Typography>

          {/* Navigation links with accessibility support */}
          <Stack
            component="nav"
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 1.5, sm: 3 }}
            alignItems="center"
            aria-label="Footer Navigation"
          >
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-label={link.ariaLabel}
                underline="hover"
                sx={{
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-sm)',
                  transition: 'color var(--transition-duration-fast) var(--transition-timing)',
                  '&:hover': {
                    color: 'var(--color-primary)'
                  },
                  '&:focus-visible': {
                    outline: '2px solid var(--color-primary)',
                    outlineOffset: '2px'
                  }
                }}
              >
                {link.label}
              </Link>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};

export default Footer;