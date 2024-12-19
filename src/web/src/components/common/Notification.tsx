// @version: react@18.0.0
// @version: @mui/material@5.0.0
// @version: use-sound@4.0.1

import React, { useCallback, useEffect } from 'react';
import { Snackbar, Alert, Slide, Fade } from '@mui/material';
import { styled } from '@mui/material/styles';
import useSound from 'use-sound';
import { useNotification } from '../../hooks/useNotification';
import { NotificationType } from '../../types/api';

// Enhanced styled components for notifications
const StyledAlert = styled(Alert)(({ theme }) => ({
  width: '100%',
  alignItems: 'center',
  '& .MuiAlert-message': {
    flex: 1,
    marginRight: theme.spacing(2),
  },
  '& .MuiAlert-icon': {
    marginRight: theme.spacing(2),
    fontSize: 24,
  },
  '& .MuiAlert-action': {
    marginLeft: 'auto',
    padding: 0,
  },
}));

// Constants for notification configuration
const SEVERITY_MAP = {
  [NotificationType.SUCCESS]: 'success',
  [NotificationType.ERROR]: 'error',
  [NotificationType.WARNING]: 'warning',
  [NotificationType.INFO]: 'info',
  [NotificationType.CRITICAL]: 'error',
} as const;

const POSITION_STYLES = {
  'top': { top: 24, left: '50%', transform: 'translateX(-50%)' },
  'bottom': { bottom: 24, left: '50%', transform: 'translateX(-50%)' },
  'top-left': { top: 24, left: 24 },
  'top-right': { top: 24, right: 24 },
  'bottom-left': { bottom: 24, left: 24 },
  'bottom-right': { bottom: 24, right: 24 },
} as const;

const SOUND_EFFECTS = {
  [NotificationType.SUCCESS]: '/sounds/success.mp3',
  [NotificationType.ERROR]: '/sounds/error.mp3',
  [NotificationType.WARNING]: '/sounds/warning.mp3',
  [NotificationType.INFO]: '/sounds/info.mp3',
  [NotificationType.CRITICAL]: '/sounds/critical.mp3',
} as const;

const ANIMATION_DURATION = {
  ENTER: 225,
  EXIT: 195,
} as const;

// Enhanced interface for notification props
interface NotificationProps {
  open: boolean;
  message: string | React.ReactNode;
  type: NotificationType;
  autoHideDuration?: number;
  position?: keyof typeof POSITION_STYLES;
  persist?: boolean;
  action?: React.ReactNode;
  onAction?: (event: React.MouseEvent) => void;
  elevation?: number;
}

// Enhanced notification component with accessibility and animations
const Notification: React.FC<NotificationProps> = React.memo(({
  open,
  message,
  type = NotificationType.INFO,
  autoHideDuration = 4000,
  position = 'bottom',
  persist = false,
  action,
  onAction,
  elevation = 6,
}) => {
  const { notificationState, hideNotification, queueNotification } = useNotification();

  // Initialize sound effects for different notification types
  const [playSuccess] = useSound(SOUND_EFFECTS[NotificationType.SUCCESS], { volume: 0.5 });
  const [playError] = useSound(SOUND_EFFECTS[NotificationType.ERROR], { volume: 0.7 });
  const [playWarning] = useSound(SOUND_EFFECTS[NotificationType.WARNING], { volume: 0.6 });
  const [playInfo] = useSound(SOUND_EFFECTS[NotificationType.INFO], { volume: 0.4 });
  const [playCritical] = useSound(SOUND_EFFECTS[NotificationType.CRITICAL], { volume: 1.0 });

  // Enhanced close handler with sound effects and persistence
  const handleClose = useCallback((event: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway' && !persist) {
      return;
    }

    if (reason === 'timeout' && persist) {
      queueNotification({ message, type, autoHideDuration });
      return;
    }

    hideNotification();
  }, [hideNotification, message, type, autoHideDuration, persist, queueNotification]);

  // Play sound effects based on notification type
  useEffect(() => {
    if (open) {
      switch (type) {
        case NotificationType.SUCCESS:
          playSuccess();
          break;
        case NotificationType.ERROR:
          playError();
          break;
        case NotificationType.WARNING:
          playWarning();
          break;
        case NotificationType.INFO:
          playInfo();
          break;
        case NotificationType.CRITICAL:
          playCritical();
          break;
      }
    }
  }, [open, type, playSuccess, playError, playWarning, playInfo, playCritical]);

  // Enhanced keyboard event handler for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && !persist) {
      hideNotification();
    }
  }, [hideNotification, persist]);

  return (
    <Snackbar
      open={open}
      autoHideDuration={persist ? null : autoHideDuration}
      onClose={handleClose}
      TransitionComponent={position.includes('top') ? Slide : Fade}
      TransitionProps={{
        direction: position.includes('top') ? 'down' : 'up',
        timeout: {
          enter: ANIMATION_DURATION.ENTER,
          exit: ANIMATION_DURATION.EXIT,
        },
      }}
      anchorOrigin={POSITION_STYLES[position]}
      sx={{
        maxWidth: '90vw',
        width: 'auto',
        minWidth: 288,
      }}
    >
      <StyledAlert
        elevation={elevation}
        variant="filled"
        severity={SEVERITY_MAP[type]}
        onClose={persist ? undefined : handleClose}
        action={action}
        onClick={onAction}
        onKeyDown={handleKeyDown}
        role={type === NotificationType.CRITICAL ? 'alert' : 'status'}
        aria-live={type === NotificationType.CRITICAL ? 'assertive' : 'polite'}
        sx={{
          width: '100%',
          boxShadow: (theme) => type === NotificationType.CRITICAL 
            ? `0 0 0 2px ${theme.palette.error.main}`
            : undefined,
          animation: type === NotificationType.CRITICAL 
            ? 'pulse 2s infinite'
            : undefined,
          '@keyframes pulse': {
            '0%': { transform: 'scale(1)' },
            '50%': { transform: 'scale(1.02)' },
            '100%': { transform: 'scale(1)' },
          },
        }}
      >
        {message}
      </StyledAlert>
    </Snackbar>
  );
});

Notification.displayName = 'Notification';

export default Notification;