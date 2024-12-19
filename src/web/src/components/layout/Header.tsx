import React, { useState, useCallback, useEffect } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Badge,
  Divider,
  useScrollTrigger,
  Box,
  Tooltip
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle,
  Brightness4,
  Brightness7,
  Security,
  DevicesOther,
  Warning,
  Language
} from '@mui/icons-material';
import { Button } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';

// Version comments for external dependencies
// @mui/material: ^5.0.0
// @mui/icons-material: ^5.0.0
// react: ^18.0.0

/**
 * Props interface for Header component
 */
interface HeaderProps {
  onThemeToggle: () => void;
  onLanguageChange: (lang: string) => void;
}

/**
 * Styled components following Material Design 3.0 principles
 */
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  transition: theme.transitions.create(['background-color', 'box-shadow'], {
    duration: theme.transitions.duration.standard,
  }),
  boxShadow: 'var(--elevation-1)',
  zIndex: theme.zIndex.drawer + 1,
}));

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  padding: theme.spacing(0, 3),
  justifyContent: 'space-between',
  minHeight: 64,
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(0, 1),
    minHeight: 56,
  },
}));

const LogoContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const ActionContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

/**
 * Enhanced Header component with security features and responsive design
 */
const Header: React.FC<HeaderProps> = React.memo(({ onThemeToggle, onLanguageChange }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const trigger = useScrollTrigger({ disableHysteresis: true, threshold: 0 });

  // Auth state and security features
  const { user, logout, mfaStatus, deviceInfo } = useAuth();

  // Menu states
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState<null | HTMLElement>(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [languageMenuAnchor, setLanguageMenuAnchor] = useState<null | HTMLElement>(null);

  // Security status checks
  const hasSecurityWarnings = !mfaStatus.verified || !deviceInfo?.verified;
  const sessionValid = useAuth().sessionValidity.isValid;

  // Menu handlers
  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMenuAnchor(event.currentTarget);
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleLanguageMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setLanguageMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMobileMenuAnchor(null);
    setUserMenuAnchor(null);
    setLanguageMenuAnchor(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
  };

  // Session warning effect
  useEffect(() => {
    if (!sessionValid) {
      // Handle session expiration
      logout();
    }
  }, [sessionValid, logout]);

  // Render security status indicator
  const renderSecurityStatus = () => (
    <Tooltip title={hasSecurityWarnings ? "Security warnings detected" : "Security status normal"}>
      <Badge
        color={hasSecurityWarnings ? "error" : "success"}
        variant="dot"
        overlap="circular"
      >
        <Security color={hasSecurityWarnings ? "error" : "success"} />
      </Badge>
    </Tooltip>
  );

  return (
    <StyledAppBar
      position="fixed"
      color="default"
      elevation={trigger ? 4 : 0}
    >
      <StyledToolbar>
        {/* Logo and Brand */}
        <LogoContainer>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open menu"
              onClick={handleMobileMenuOpen}
              edge="start"
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" color="textPrimary" noWrap>
            OTPless Billing
          </Typography>
        </LogoContainer>

        {/* Desktop Actions */}
        {!isMobile && (
          <ActionContainer>
            {/* Theme Toggle */}
            <IconButton onClick={onThemeToggle} color="inherit" aria-label="toggle theme">
              {theme.palette.mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
            </IconButton>

            {/* Language Selector */}
            <IconButton
              onClick={handleLanguageMenuOpen}
              color="inherit"
              aria-label="change language"
            >
              <Language />
            </IconButton>

            {/* Security Status */}
            {renderSecurityStatus()}

            {/* User Menu */}
            {user && (
              <Button
                startIcon={<AccountCircle />}
                onClick={handleUserMenuOpen}
                variant="text"
                color={hasSecurityWarnings ? "warning" : "primary"}
              >
                {user.email}
              </Button>
            )}
          </ActionContainer>
        )}

        {/* Mobile Menu */}
        <Menu
          anchorEl={mobileMenuAnchor}
          open={Boolean(mobileMenuAnchor)}
          onClose={handleMenuClose}
          keepMounted
        >
          <MenuItem onClick={onThemeToggle}>
            {theme.palette.mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
            <Typography ml={1}>Theme</Typography>
          </MenuItem>
          <MenuItem onClick={handleLanguageMenuOpen}>
            <Language />
            <Typography ml={1}>Language</Typography>
          </MenuItem>
          <Divider />
          {user && (
            <MenuItem onClick={handleUserMenuOpen}>
              <AccountCircle />
              <Typography ml={1}>{user.email}</Typography>
            </MenuItem>
          )}
        </Menu>

        {/* User Menu */}
        <Menu
          anchorEl={userMenuAnchor}
          open={Boolean(userMenuAnchor)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleMenuClose}>
            <Security />
            <Typography ml={1}>Security Settings</Typography>
          </MenuItem>
          <MenuItem onClick={handleMenuClose}>
            <DevicesOther />
            <Typography ml={1}>Device Management</Typography>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <Typography color="error">Logout</Typography>
          </MenuItem>
        </Menu>

        {/* Language Menu */}
        <Menu
          anchorEl={languageMenuAnchor}
          open={Boolean(languageMenuAnchor)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => { onLanguageChange('en'); handleMenuClose(); }}>
            English
          </MenuItem>
          <MenuItem onClick={() => { onLanguageChange('hi'); handleMenuClose(); }}>
            हिंदी
          </MenuItem>
        </Menu>
      </StyledToolbar>
    </StyledAppBar>
  );
});

// Display name for debugging
Header.displayName = 'Header';

export default Header;