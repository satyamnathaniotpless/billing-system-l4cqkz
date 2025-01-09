import React, { useMemo, useCallback, useState } from 'react';
import {
  DataGrid as MuiDataGrid,
  GridColDef,
  GridSortModel,
  GridFilterModel,
  GridSelectionModel,
  GridToolbar,
  GridRowParams,
  GridValueFormatterParams
} from '@mui/x-data-grid';
import { Box, Paper, Typography, Skeleton, useTheme, useMediaQuery } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useDebounce } from 'use-debounce';

// Internal imports
import Button from './Button';
import Select from './Select';
import { formatNumber, truncateText, formatDate } from '../../utils/format';
import { PAGINATION } from '../../config/constants';

/**
 * Props interface for DataGrid component
 */
export interface DataGridProps<T> {
  rows: T[];
  columns: GridColDef[];
  title: string;
  loading?: boolean;
  error?: Error;
  pagination?: boolean;
  selection?: boolean;
  virtualScroll?: boolean;
  exportOptions?: {
    formats: string[];
    filename: string;
  };
  onSelectionChange?: (model: GridSelectionModel) => void;
  onExport?: (format: string) => void;
}

/**
 * Styled wrapper for MUI DataGrid with enterprise styling
 */
const StyledDataGrid = styled(MuiDataGrid)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
  '& .MuiDataGrid-columnHeader': {
    backgroundColor: theme.palette.mode === 'light' 
      ? theme.palette.grey[100] 
      : theme.palette.grey[900],
    fontWeight: 600
  },
  '& .MuiDataGrid-row': {
    '&:hover': {
      backgroundColor: theme.palette.action.hover
    },
    '&.Mui-selected': {
      backgroundColor: theme.palette.action.selected,
      '&:hover': {
        backgroundColor: theme.palette.action.selected
      }
    }
  },
  // Accessibility enhancements
  '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '-1px'
  }
}));

/**
 * Enhanced toolbar with responsive design
 */
const StyledToolbar = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: theme.spacing(2),
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: `1px solid ${theme.palette.divider}`
}));

/**
 * DataGrid component with enterprise features and accessibility support
 */
const DataGrid = <T extends Record<string, any>>({
  rows,
  columns,
  title,
  loading = false,
  error,
  pagination = true,
  selection = false,
  virtualScroll = false,
  exportOptions,
  onSelectionChange,
  onExport
}: DataGridProps<T>): JSX.Element => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // State management
  const [pageSize, setPageSize] = useState(PAGINATION.DEFAULT_LIMIT);
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  const [filterModel, setFilterModel] = useState<GridFilterModel>({
    items: []
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

  // Memoized column configuration with responsive handling
  const responsiveColumns = useMemo(() => {
    return columns.map(column => ({
      ...column,
      hide: isMobile && column.hideable,
      // Enhanced value formatting
      valueFormatter: (params: GridValueFormatterParams) => {
        if (column.type === 'number') {
          return formatNumber(params.value);
        }
        if (column.type === 'date') {
          return formatDate(params.value);
        }
        if (typeof params.value === 'string') {
          return truncateText(params.value, 30);
        }
        return params.value;
      }
    }));
  }, [columns, isMobile]);

  // Handlers
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
  }, []);

  const handleSortModelChange = useCallback((newSortModel: GridSortModel) => {
    setSortModel(newSortModel);
  }, []);

  const handleFilterModelChange = useCallback((newFilterModel: GridFilterModel) => {
    setFilterModel(newFilterModel);
  }, []);

  const handleExport = useCallback((format: string) => {
    if (onExport) {
      onExport(format);
    }
  }, [onExport]);

  // Loading state
  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        <Skeleton variant="rectangular" height={400} />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', color: 'error.main' }}>
        <Typography variant="h6">Error loading data</Typography>
        <Typography variant="body2">{error.message}</Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={1}>
      <StyledToolbar>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        
        {exportOptions && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {exportOptions.formats.map(format => (
              <Button
                key={format}
                size="small"
                variant="outlined"
                onClick={() => handleExport(format)}
                aria-label={`Export as ${format}`}
              >
                Export {format.toUpperCase()}
              </Button>
            ))}
          </Box>
        )}
      </StyledToolbar>

      <StyledDataGrid
        rows={rows}
        columns={responsiveColumns}
        pageSize={pageSize}
        rowsPerPageOptions={PAGINATION.PAGE_SIZE_OPTIONS}
        checkboxSelection={selection}
        disableSelectionOnClick
        autoHeight
        pagination={pagination}
        loading={loading}
        sortModel={sortModel}
        filterModel={filterModel}
        onPageSizeChange={handlePageSizeChange}
        onSortModelChange={handleSortModelChange}
        onFilterModelChange={handleFilterModelChange}
        onSelectionModelChange={onSelectionChange}
        components={{
          Toolbar: GridToolbar
        }}
        componentsProps={{
          toolbar: {
            showQuickFilter: true,
            quickFilterProps: { debounceMs: 300 }
          }
        }}
        // Accessibility props
        aria-label={title}
        aria-describedby={`${title}-description`}
        getRowId={(row: T) => row.id || Math.random().toString()}
        sx={{
          // Ensure minimum height for empty state
          minHeight: 400,
          // Responsive padding
          '& .MuiDataGrid-main': {
            px: { xs: 1, sm: 2 }
          }
        }}
      />
    </Paper>
  );
};

// Display name for debugging
DataGrid.displayName = 'DataGrid';

export default React.memo(DataGrid);