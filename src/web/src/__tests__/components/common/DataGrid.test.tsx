import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ThemeProvider } from '@mui/material/styles';
import { axe, toHaveNoViolations } from '@axe-core/react';
import DataGrid from '../../components/common/DataGrid';
import { createTheme } from '@mui/material/styles';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock theme for testing
const theme = createTheme();

// Mock data for testing
const mockData = {
  rows: [
    { id: 1, name: 'Test Customer 1', value: 100, status: 'active' },
    { id: 2, name: 'Test Customer 2', value: 200, status: 'inactive' },
    { id: 3, name: 'Test Customer 3', value: 300, status: 'active' }
  ],
  columns: [
    { field: 'id', headerName: 'ID', width: 100, sortable: true },
    { field: 'name', headerName: 'Name', width: 200, filterable: true },
    { field: 'value', headerName: 'Value', width: 150, type: 'number' },
    { field: 'status', headerName: 'Status', width: 150, type: 'string' }
  ]
};

// Mock handlers
const mockHandlers = {
  onPageChange: jest.fn(),
  onSortModelChange: jest.fn(),
  onFilterModelChange: jest.fn(),
  onSelectionModelChange: jest.fn(),
  onExport: jest.fn()
};

describe('DataGrid Component', () => {
  // Setup and teardown
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // Wrapper component for consistent rendering
  const renderWithTheme = (ui: React.ReactElement) => {
    return render(
      <ThemeProvider theme={theme}>
        {ui}
      </ThemeProvider>
    );
  };

  test('renders with basic props and data', () => {
    renderWithTheme(
      <DataGrid
        rows={mockData.rows}
        columns={mockData.columns}
        title="Test Grid"
      />
    );

    // Verify basic rendering
    expect(screen.getByText('Test Grid')).toBeInTheDocument();
    expect(screen.getByRole('grid')).toBeInTheDocument();
    mockData.rows.forEach(row => {
      expect(screen.getByText(row.name)).toBeInTheDocument();
    });
  });

  test('handles loading state correctly', () => {
    renderWithTheme(
      <DataGrid
        rows={[]}
        columns={mockData.columns}
        title="Loading Grid"
        loading={true}
      />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('handles error state correctly', () => {
    const error = new Error('Test error');
    renderWithTheme(
      <DataGrid
        rows={[]}
        columns={mockData.columns}
        title="Error Grid"
        error={error}
      />
    );

    expect(screen.getByText('Error loading data')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  test('supports pagination functionality', async () => {
    renderWithTheme(
      <DataGrid
        rows={mockData.rows}
        columns={mockData.columns}
        title="Paginated Grid"
        pagination
        onPageChange={mockHandlers.onPageChange}
      />
    );

    // Find pagination controls
    const pagination = screen.getByRole('navigation');
    const nextPageButton = within(pagination).getByRole('button', { name: /next page/i });

    // Test page navigation
    fireEvent.click(nextPageButton);
    await waitFor(() => {
      expect(mockHandlers.onPageChange).toHaveBeenCalled();
    });
  });

  test('supports sorting functionality', async () => {
    renderWithTheme(
      <DataGrid
        rows={mockData.rows}
        columns={mockData.columns}
        title="Sortable Grid"
        onSortModelChange={mockHandlers.onSortModelChange}
      />
    );

    // Find sortable column header
    const sortableHeader = screen.getByText('ID');
    
    // Test sorting
    fireEvent.click(sortableHeader);
    await waitFor(() => {
      expect(mockHandlers.onSortModelChange).toHaveBeenCalled();
    });
  });

  test('supports filtering functionality', async () => {
    renderWithTheme(
      <DataGrid
        rows={mockData.rows}
        columns={mockData.columns}
        title="Filterable Grid"
        onFilterModelChange={mockHandlers.onFilterModelChange}
      />
    );

    // Open filter menu
    const filterButton = screen.getByRole('button', { name: /show filters/i });
    fireEvent.click(filterButton);

    // Apply filter
    const filterInput = await screen.findByRole('textbox');
    fireEvent.change(filterInput, { target: { value: 'Test Customer 1' } });

    await waitFor(() => {
      expect(mockHandlers.onFilterModelChange).toHaveBeenCalled();
    });
  });

  test('supports row selection', async () => {
    renderWithTheme(
      <DataGrid
        rows={mockData.rows}
        columns={mockData.columns}
        title="Selectable Grid"
        selection
        onSelectionChange={mockHandlers.onSelectionModelChange}
      />
    );

    // Find and click checkbox
    const checkbox = screen.getAllByRole('checkbox')[1]; // First row checkbox
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(mockHandlers.onSelectionModelChange).toHaveBeenCalledWith([1]);
    });
  });

  test('supports export functionality', async () => {
    renderWithTheme(
      <DataGrid
        rows={mockData.rows}
        columns={mockData.columns}
        title="Exportable Grid"
        exportOptions={{
          formats: ['csv', 'pdf'],
          filename: 'test-export'
        }}
        onExport={mockHandlers.onExport}
      />
    );

    // Find and click export button
    const exportButton = screen.getByRole('button', { name: /export as csv/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockHandlers.onExport).toHaveBeenCalledWith('csv');
    });
  });

  test('maintains accessibility standards', async () => {
    const { container } = renderWithTheme(
      <DataGrid
        rows={mockData.rows}
        columns={mockData.columns}
        title="Accessible Grid"
      />
    );

    // Run accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Check ARIA attributes
    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('aria-label');
    expect(grid).toHaveAttribute('aria-rowcount');
    expect(grid).toHaveAttribute('aria-colcount');
  });

  test('handles responsive behavior', () => {
    // Mock window resize
    global.innerWidth = 500; // Mobile width
    global.dispatchEvent(new Event('resize'));

    renderWithTheme(
      <DataGrid
        rows={mockData.rows}
        columns={mockData.columns}
        title="Responsive Grid"
      />
    );

    // Verify responsive layout
    const grid = screen.getByRole('grid');
    expect(grid).toHaveStyle({ minHeight: '400px' });
  });

  test('handles empty state correctly', () => {
    renderWithTheme(
      <DataGrid
        rows={[]}
        columns={mockData.columns}
        title="Empty Grid"
      />
    );

    expect(screen.getByText(/no rows/i)).toBeInTheDocument();
  });
});