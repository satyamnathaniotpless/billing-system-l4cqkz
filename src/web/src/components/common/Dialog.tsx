import React, { useCallback, useId } from 'react';
import { 
  Dialog as MuiDialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Close } from '@mui/icons-material';
import Button from './Button';

/**
 * Props interface for Dialog component with enhanced accessibility and control options
 */
interface DialogProps {
  /** Controls dialog visibility state */
  open: boolean;
  /** Handler for dialog close events */
  onClose: () => void;
  /** Dialog title text with aria-labelledby support */
  title: string;
  /** Dialog content with aria-describedby support */
  children: React.ReactNode;
  /** Maximum width breakpoint for responsive sizing */
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Controls if dialog takes full width up to maxWidth */
  fullWidth?: boolean;
  /** Custom action buttons with keyboard navigation support */
  actions?: React.ReactNode;
  /** Prevents dialog close on backdrop click for modal workflows */
  disableBackdropClick?: boolean;
  /** Prevents dialog close on ESC key for secure workflows */
  disableEscapeKeyDown?: boolean;
}

/**
 * Styled MUI Dialog component with theme integration and enhanced visual hierarchy
 */
const StyledDialog = styled(MuiDialog)(({ theme }) => ({
  // Backdrop styling
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    transition: theme.transitions.create('opacity'),
  },

  // Dialog paper styling following 8px grid
  '& .MuiDialog-paper': {
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    borderRadius: 'var(--border-radius-lg)',
    boxShadow: 'var(--elevation-3)',
    margin: theme.spacing(2),
    padding: theme.spacing(1),
    transition: theme.transitions.create(['transform', 'opacity']),

    [theme.breakpoints.up('sm')]: {
      padding: theme.spacing(2),
    },
  },

  // Dialog title styling
  '& .MuiDialogTitle-root': {
    padding: theme.spacing(2),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },

  // Dialog content styling
  '& .MuiDialogContent-root': {
    padding: theme.spacing(2),
    color: 'var(--color-text-secondary)',
    fontSize: 'var(--font-size-md)',
    lineHeight: 'var(--line-height-normal)',
  },

  // Dialog actions styling
  '& .MuiDialogActions-root': {
    padding: theme.spacing(2),
    gap: theme.spacing(1),
  },

  // Close button styling
  '& .dialog-close-button': {
    color: 'var(--color-text-secondary)',
    transition: theme.transitions.create('color'),
    '&:hover': {
      color: 'var(--color-text-primary)',
    },
  },
}));

/**
 * Dialog component with comprehensive accessibility support
 * 
 * @component
 * @example
 * // Basic usage
 * <Dialog
 *   open={isOpen}
 *   onClose={handleClose}
 *   title="Confirmation"
 * >
 *   Are you sure you want to proceed?
 * </Dialog>
 * 
 * // With custom actions
 * <Dialog
 *   open={isOpen}
 *   onClose={handleClose}
 *   title="Delete Item"
 *   actions={
 *     <>
 *       <Button onClick={handleCancel}>Cancel</Button>
 *       <Button color="error" onClick={handleDelete}>Delete</Button>
 *     </>
 *   }
 * >
 *   This action cannot be undone.
 * </Dialog>
 */
const Dialog = React.memo<DialogProps>(({
  open,
  onClose,
  title,
  children,
  maxWidth = 'sm',
  fullWidth = true,
  actions,
  disableBackdropClick = false,
  disableEscapeKeyDown = false,
}) => {
  // Generate unique IDs for accessibility
  const titleId = useId();
  const contentId = useId();

  // Handle backdrop click
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (!disableBackdropClick) {
      onClose();
    }
  }, [disableBackdropClick, onClose]);

  return (
    <StyledDialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      aria-labelledby={titleId}
      aria-describedby={contentId}
      onBackdropClick={handleBackdropClick}
      disableEscapeKeyDown={disableEscapeKeyDown}
      // Additional accessibility attributes
      role="dialog"
      aria-modal="true"
    >
      <DialogTitle id={titleId}>
        <Typography
          variant="h6"
          component="h2"
          sx={{ fontWeight: 600 }}
        >
          {title}
        </Typography>
        <IconButton
          className="dialog-close-button"
          onClick={onClose}
          aria-label="Close dialog"
          size="large"
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent id={contentId}>
        {children}
      </DialogContent>

      {actions && (
        <DialogActions>
          {actions}
        </DialogActions>
      )}
    </StyledDialog>
  );
});

// Display name for debugging
Dialog.displayName = 'Dialog';

export default Dialog;
export type { DialogProps };