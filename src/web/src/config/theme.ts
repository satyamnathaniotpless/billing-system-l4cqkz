// @mui/material version: ^5.0.0
import { createTheme, Theme } from '@mui/material/styles';
import type { ThemeOptions } from '@mui/material/styles';

// Constants for theme configuration
const SPACING_UNIT = 8;
const FONT_FAMILY = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const BORDER_RADIUS = 8;

// Transition durations for animations
const transitions = {
  shortest: 150,
  shorter: 200,
  short: 250,
  standard: 300,
  complex: 375,
  enteringScreen: 225,
  leavingScreen: 195,
};

// Breakpoints following Material Design guidelines
const breakpoints = {
  values: {
    xs: 0,
    sm: 768,
    md: 1024,
    lg: 1440,
    xl: 1920,
  },
};

// Shared typography configuration
const typography = {
  fontFamily: FONT_FAMILY,
  fontWeightLight: 300,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700,
  h1: {
    fontSize: '2.5rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.01562em',
  },
  h2: {
    fontSize: '2rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.00833em',
  },
  h3: {
    fontSize: '1.75rem',
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: '0em',
  },
  h4: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: '0.00735em',
  },
  h5: {
    fontSize: '1.25rem',
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: '0em',
  },
  h6: {
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: '0.0075em',
  },
  subtitle1: {
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: '0.00938em',
  },
  subtitle2: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.57,
    letterSpacing: '0.00714em',
  },
  body1: {
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: '0.00938em',
  },
  body2: {
    fontSize: '0.875rem',
    fontWeight: 400,
    lineHeight: 1.43,
    letterSpacing: '0.01071em',
  },
  button: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.75,
    letterSpacing: '0.02857em',
    textTransform: 'none',
  },
  caption: {
    fontSize: '0.75rem',
    fontWeight: 400,
    lineHeight: 1.66,
    letterSpacing: '0.03333em',
  },
  overline: {
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 2.66,
    letterSpacing: '0.08333em',
    textTransform: 'uppercase',
  },
};

// Light theme configuration
const createLightTheme = (): Theme => {
  const lightThemeOptions: ThemeOptions = {
    palette: {
      mode: 'light',
      primary: {
        main: '#1976D2', // WCAG AA compliant
        light: '#42A5F5',
        dark: '#1565C0',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: '#9C27B0',
        light: '#BA68C8',
        dark: '#7B1FA2',
        contrastText: '#FFFFFF',
      },
      error: {
        main: '#D32F2F',
        light: '#EF5350',
        dark: '#C62828',
        contrastText: '#FFFFFF',
      },
      warning: {
        main: '#ED6C02',
        light: '#FF9800',
        dark: '#E65100',
        contrastText: '#FFFFFF',
      },
      info: {
        main: '#0288D1',
        light: '#03A9F4',
        dark: '#01579B',
        contrastText: '#FFFFFF',
      },
      success: {
        main: '#2E7D32',
        light: '#4CAF50',
        dark: '#1B5E20',
        contrastText: '#FFFFFF',
      },
      grey: {
        50: '#FAFAFA',
        100: '#F5F5F5',
        200: '#EEEEEE',
        300: '#E0E0E0',
        400: '#BDBDBD',
        500: '#9E9E9E',
        600: '#757575',
        700: '#616161',
        800: '#424242',
        900: '#212121',
      },
      background: {
        default: '#FFFFFF',
        paper: '#F5F5F5',
      },
      text: {
        primary: 'rgba(0, 0, 0, 0.87)',
        secondary: 'rgba(0, 0, 0, 0.6)',
        disabled: 'rgba(0, 0, 0, 0.38)',
      },
      divider: 'rgba(0, 0, 0, 0.12)',
    },
    typography,
    spacing: (factor: number) => `${SPACING_UNIT * factor}px`,
    breakpoints,
    shape: {
      borderRadius: BORDER_RADIUS,
    },
    transitions: {
      duration: transitions,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: BORDER_RADIUS,
            textTransform: 'none',
            fontWeight: 500,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: BORDER_RADIUS,
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            padding: `${SPACING_UNIT * 1.5}px ${SPACING_UNIT * 2}px`,
          },
        },
      },
    },
  };

  return createTheme(lightThemeOptions);
};

// Dark theme configuration
const createDarkTheme = (): Theme => {
  const darkThemeOptions: ThemeOptions = {
    palette: {
      mode: 'dark',
      primary: {
        main: '#90CAF9', // WCAG AA compliant for dark mode
        light: '#B3E5FC',
        dark: '#42A5F5',
        contrastText: '#000000',
      },
      secondary: {
        main: '#CE93D8',
        light: '#E1BEE7',
        dark: '#AB47BC',
        contrastText: '#000000',
      },
      error: {
        main: '#EF5350',
        light: '#FF8A80',
        dark: '#D32F2F',
        contrastText: '#000000',
      },
      warning: {
        main: '#FFB74D',
        light: '#FFE0B2',
        dark: '#F57C00',
        contrastText: '#000000',
      },
      info: {
        main: '#4FC3F7',
        light: '#B3E5FC',
        dark: '#0288D1',
        contrastText: '#000000',
      },
      success: {
        main: '#81C784',
        light: '#C8E6C9',
        dark: '#388E3C',
        contrastText: '#000000',
      },
      grey: {
        50: '#FAFAFA',
        100: '#F5F5F5',
        200: '#EEEEEE',
        300: '#E0E0E0',
        400: '#BDBDBD',
        500: '#9E9E9E',
        600: '#757575',
        700: '#616161',
        800: '#424242',
        900: '#212121',
      },
      background: {
        default: '#121212',
        paper: '#1E1E1E',
      },
      text: {
        primary: '#FFFFFF',
        secondary: 'rgba(255, 255, 255, 0.7)',
        disabled: 'rgba(255, 255, 255, 0.5)',
      },
      divider: 'rgba(255, 255, 255, 0.12)',
    },
    typography,
    spacing: (factor: number) => `${SPACING_UNIT * factor}px`,
    breakpoints,
    shape: {
      borderRadius: BORDER_RADIUS,
    },
    transitions: {
      duration: transitions,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: BORDER_RADIUS,
            textTransform: 'none',
            fontWeight: 500,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: '#1E1E1E',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: BORDER_RADIUS,
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            padding: `${SPACING_UNIT * 1.5}px ${SPACING_UNIT * 2}px`,
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          },
        },
      },
    },
  };

  return createTheme(darkThemeOptions);
};

export const lightTheme = createLightTheme();
export const darkTheme = createDarkTheme();