import React, { useState, useCallback, useEffect } from 'react';
import { 
  Box, 
  Card, 
  Grid, 
  Typography, 
  Switch, 
  Divider,
  useTheme,
  useMediaQuery,
  Alert
} from '@mui/material';
import { 
  NotificationsOutlined,
  SecurityOutlined,
  PaymentOutlined,
  ApiOutlined,
  LanguageOutlined,
  DarkModeOutlined
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/common/PageHeader';
import TextField from '../../components/common/TextField';
import Select from '../../components/common/Select';
import Button from '../../components/common/Button';

// Interface for system settings
interface SystemSettings {
  defaultCurrency: string;
  defaultLanguage: string;
  lowBalanceThreshold: number;
  emailNotifications: boolean;
  apiRateLimit: number;
  securitySettings: {
    mfaRequired: boolean;
    sessionTimeout: number;
    passwordExpiry: number;
    ipWhitelist: string[];
  };
  darkMode: boolean;
}

// Default settings values
const defaultSettings: SystemSettings = {
  defaultCurrency: 'INR',
  defaultLanguage: 'en',
  lowBalanceThreshold: 1000,
  emailNotifications: true,
  apiRateLimit: 1000,
  securitySettings: {
    mfaRequired: true,
    sessionTimeout: 30,
    passwordExpiry: 90,
    ipWhitelist: [],
  },
  darkMode: false,
};

const Settings: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State management
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Currency options
  const currencyOptions = [
    { value: 'INR', label: 'Indian Rupee (₹)' },
    { value: 'USD', label: 'US Dollar ($)' },
    { value: 'IDR', label: 'Indonesian Rupiah (Rp)' },
  ];

  // Language options
  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'hi', label: 'Hindi' },
    { value: 'id', label: 'Indonesian' },
  ];

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // TODO: Implement API call to load settings
        // const response = await api.getSystemSettings();
        // setSettings(response.data);
      } catch (err) {
        setError('Failed to load settings');
        console.error('Error loading settings:', err);
      }
    };

    loadSettings();
  }, []);

  // Handle settings changes
  const handleSettingsChange = useCallback((
    field: keyof SystemSettings | string,
    value: any
  ) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      
      // Handle nested security settings
      if (field.startsWith('security.')) {
        const securityField = field.split('.')[1];
        newSettings.securitySettings = {
          ...newSettings.securitySettings,
          [securityField]: value
        };
      } else {
        (newSettings as any)[field] = value;
      }
      
      return newSettings;
    });
    setIsDirty(true);
  }, []);

  // Handle save settings
  const handleSaveSettings = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    try {
      // TODO: Implement API call to save settings
      // await api.updateSystemSettings(settings);
      setIsDirty(false);
      // Show success message
    } catch (err) {
      setError('Failed to save settings');
      console.error('Error saving settings:', err);
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  return (
    <Box>
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        breadcrumbs={[
          { label: t('common.dashboard'), href: '/' },
          { label: t('settings.title') }
        ]}
        actions={[
          <Button
            key="save"
            variant="contained"
            color="primary"
            loading={isSaving}
            disabled={!isDirty}
            onClick={handleSaveSettings}
          >
            {t('common.save')}
          </Button>
        ]}
      />

      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* General Settings */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <LanguageOutlined sx={{ mr: 1 }} />
              <Typography variant="h6">{t('settings.general.title')}</Typography>
            </Box>
            
            <Select
              name="defaultLanguage"
              label={t('settings.general.language')}
              value={settings.defaultLanguage}
              options={languageOptions}
              onChange={(e) => handleSettingsChange('defaultLanguage', e.target.value)}
              fullWidth
            />

            <Select
              name="defaultCurrency"
              label={t('settings.general.currency')}
              value={settings.defaultCurrency}
              options={currencyOptions}
              onChange={(e) => handleSettingsChange('defaultCurrency', e.target.value)}
              fullWidth
            />

            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <DarkModeOutlined sx={{ mr: 1 }} />
              <Typography>{t('settings.general.darkMode')}</Typography>
              <Switch
                checked={settings.darkMode}
                onChange={(e) => handleSettingsChange('darkMode', e.target.checked)}
              />
            </Box>
          </Card>
        </Grid>

        {/* Billing Settings */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <PaymentOutlined sx={{ mr: 1 }} />
              <Typography variant="h6">{t('settings.billing.title')}</Typography>
            </Box>

            <TextField
              inputType="currency"
              label={t('settings.billing.lowBalanceThreshold')}
              value={settings.lowBalanceThreshold.toString()}
              onChange={(e) => handleSettingsChange('lowBalanceThreshold', Number(e.target.value))}
              fullWidth
            />
          </Card>
        </Grid>

        {/* API Settings */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <ApiOutlined sx={{ mr: 1 }} />
              <Typography variant="h6">{t('settings.api.title')}</Typography>
            </Box>

            <TextField
              inputType="text"
              label={t('settings.api.rateLimit')}
              value={settings.apiRateLimit.toString()}
              onChange={(e) => handleSettingsChange('apiRateLimit', Number(e.target.value))}
              fullWidth
            />
          </Card>
        </Grid>

        {/* Security Settings */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <SecurityOutlined sx={{ mr: 1 }} />
              <Typography variant="h6">{t('settings.security.title')}</Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography>{t('settings.security.mfaRequired')}</Typography>
              <Switch
                checked={settings.securitySettings.mfaRequired}
                onChange={(e) => handleSettingsChange('security.mfaRequired', e.target.checked)}
              />
            </Box>

            <TextField
              inputType="text"
              label={t('settings.security.sessionTimeout')}
              value={settings.securitySettings.sessionTimeout.toString()}
              onChange={(e) => handleSettingsChange('security.sessionTimeout', Number(e.target.value))}
              fullWidth
            />

            <TextField
              inputType="text"
              label={t('settings.security.passwordExpiry')}
              value={settings.securitySettings.passwordExpiry.toString()}
              onChange={(e) => handleSettingsChange('security.passwordExpiry', Number(e.target.value))}
              fullWidth
            />
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;