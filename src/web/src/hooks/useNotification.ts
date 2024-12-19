// @version: react@18.0.0
// @version: react-redux@8.0.0
// @version: @mui/material@5.0.0

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useMediaQuery } from '@mui/material';
import { NotificationType } from '../types/api';

/**
 * Constants for notification configuration
 */
const DEFAULT_AUTO_HIDE_DURATION = 4000;
const DEFAULT_POSITION = 'bottom';
const MAX_QUEUE_SIZE = 5;
const ANIMATION_DURATION = 300;

/**
 * Interface for notification state with enhanced accessibility
 */
interface NotificationState {
  open: boolean;
  message: string;
  type: NotificationType;
  autoHideDuration: number;
  position: 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  priority: number;
  id: string;
  ariaLive: 'polite' | 'assertive';
  role: 'alert' | 'status';
  theme: NotificationTheme;
}

/**
 * Interface for notification queue management
 */
interface NotificationQueue {
  items: NotificationState[];
  maxSize: number;
}

/**
 * Interface for hook return value
 */
interface UseNotificationReturn {
  notificationState: NotificationState;
  showNotification: (
    message: string,
    type?: NotificationType,
    autoHideDuration?: number,
    position?: NotificationState['position'],
    priority?: number,
    theme?: NotificationTheme
  ) => void;
  hideNotification: (id: string) => void;
  clearAll: () => void;
  updateNotification: (id: string, updates: Partial<NotificationState>) => void;
}

/**
 * Enhanced custom hook for managing notifications with accessibility and mobile support
 */
export const useNotification = (): UseNotificationReturn => {
  // Initialize notification state with accessibility defaults
  const [notificationState, setNotificationState] = useState<NotificationState>({
    open: false,
    message: '',
    type: NotificationType.INFO,
    autoHideDuration: DEFAULT_AUTO_HIDE_DURATION,
    position: DEFAULT_POSITION,
    priority: 0,
    id: '',
    ariaLive: 'polite',
    role: 'status',
    theme: {} as NotificationTheme
  });

  // Initialize notification queue
  const [queue, setQueue] = useState<NotificationQueue>({
    items: [],
    maxSize: MAX_QUEUE_SIZE
  });

  // Timer refs for cleanup
  const timerRef = useRef<NodeJS.Timeout>();
  const animationTimerRef = useRef<NodeJS.Timeout>();

  // Redux integration
  const dispatch = useDispatch();

  // Media query for responsive positioning
  const isMobile = useMediaQuery('(max-width:768px)');

  /**
   * Generates a unique ID for notifications
   */
  const generateId = useCallback(() => {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Determines notification position based on screen size
   */
  const getResponsivePosition = useCallback(
    (position: NotificationState['position']): NotificationState['position'] => {
      if (isMobile) {
        return position.includes('top') ? 'top' : 'bottom';
      }
      return position;
    },
    [isMobile]
  );

  /**
   * Shows a notification with enhanced parameter validation and queue management
   */
  const showNotification = useCallback(
    (
      message: string,
      type: NotificationType = NotificationType.INFO,
      autoHideDuration: number = DEFAULT_AUTO_HIDE_DURATION,
      position: NotificationState['position'] = DEFAULT_POSITION,
      priority: number = 0,
      theme: NotificationTheme = {}
    ) => {
      const id = generateId();
      const responsivePosition = getResponsivePosition(position);

      // Determine ARIA properties based on notification type
      const ariaLive = type === NotificationType.ERROR ? 'assertive' : 'polite';
      const role = type === NotificationType.ERROR ? 'alert' : 'status';

      const newNotification: NotificationState = {
        open: true,
        message,
        type,
        autoHideDuration,
        position: responsivePosition,
        priority,
        id,
        ariaLive,
        role,
        theme
      };

      // Queue management
      setQueue((prevQueue) => {
        const updatedItems = [...prevQueue.items, newNotification]
          .sort((a, b) => b.priority - a.priority)
          .slice(0, prevQueue.maxSize);

        return {
          ...prevQueue,
          items: updatedItems
        };
      });

      // Set current notification
      setNotificationState(newNotification);

      // Set up auto-hide timer
      if (autoHideDuration > 0) {
        timerRef.current = setTimeout(() => {
          hideNotification(id);
        }, autoHideDuration);
      }

      // Dispatch to Redux store
      dispatch({
        type: 'notifications/show',
        payload: newNotification
      });
    },
    [dispatch, generateId, getResponsivePosition]
  );

  /**
   * Hides notification with enhanced cleanup and queue management
   */
  const hideNotification = useCallback(
    (id: string) => {
      // Clear timers
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setNotificationState((prev) => ({
        ...prev,
        open: false
      }));

      // Handle animation cleanup
      animationTimerRef.current = setTimeout(() => {
        setQueue((prevQueue) => ({
          ...prevQueue,
          items: prevQueue.items.filter((item) => item.id !== id)
        }));

        // Show next notification in queue if exists
        const nextNotification = queue.items[0];
        if (nextNotification) {
          setNotificationState(nextNotification);
        }

        // Dispatch to Redux store
        dispatch({
          type: 'notifications/hide',
          payload: { id }
        });
      }, ANIMATION_DURATION);
    },
    [dispatch, queue.items]
  );

  /**
   * Clears all notifications
   */
  const clearAll = useCallback(() => {
    setQueue((prev) => ({ ...prev, items: [] }));
    setNotificationState((prev) => ({ ...prev, open: false }));
    dispatch({ type: 'notifications/clearAll' });
  }, [dispatch]);

  /**
   * Updates an existing notification
   */
  const updateNotification = useCallback(
    (id: string, updates: Partial<NotificationState>) => {
      setQueue((prevQueue) => ({
        ...prevQueue,
        items: prevQueue.items.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        )
      }));

      if (notificationState.id === id) {
        setNotificationState((prev) => ({ ...prev, ...updates }));
      }

      dispatch({
        type: 'notifications/update',
        payload: { id, updates }
      });
    },
    [dispatch, notificationState.id]
  );

  /**
   * Cleanup effect
   */
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  /**
   * Screen reader announcement effect
   */
  useEffect(() => {
    if (notificationState.open && notificationState.message) {
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', notificationState.ariaLive);
      announcement.setAttribute('role', notificationState.role);
      announcement.setAttribute('aria-atomic', 'true');
      announcement.style.position = 'absolute';
      announcement.style.width = '1px';
      announcement.style.height = '1px';
      announcement.style.padding = '0';
      announcement.style.overflow = 'hidden';
      announcement.style.clip = 'rect(0, 0, 0, 0)';
      announcement.style.whiteSpace = 'nowrap';
      announcement.style.border = '0';
      announcement.textContent = notificationState.message;

      document.body.appendChild(announcement);

      return () => {
        document.body.removeChild(announcement);
      };
    }
  }, [notificationState.open, notificationState.message, notificationState.ariaLive, notificationState.role]);

  return {
    notificationState,
    showNotification,
    hideNotification,
    clearAll,
    updateNotification
  };
};

export type { NotificationState, UseNotificationReturn };