import React, { useMemo } from 'react';
import { Box, useTheme } from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from 'recharts';
// @version recharts@2.8.0
// @version @mui/material@5.0.0
// @version react@18.0.0

// Constants for chart configuration
const DEFAULT_HEIGHT = 400;
const CHART_MARGIN = { top: 20, right: 20, bottom: 20, left: 20 };
const ANIMATION_DURATION = 300;
const RESPONSIVE_CONTAINER_ASPECT = 2.5;

// Interface for series configuration
interface ChartSeries {
  dataKey: string;
  name: string;
  color?: string;
}

// Interface for axis configuration
interface AxisConfig {
  dataKey?: string;
  label?: string;
  tickFormatter?: (value: any) => string;
  interval?: number;
  domain?: [number, number];
  format?: string;
}

// Main props interface for the Chart component
interface ChartProps {
  data: any[];
  type: 'line' | 'bar' | 'area';
  height?: string | number;
  series: ChartSeries[];
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  onDataPointClick?: (point: any) => void;
  loading?: boolean;
  error?: Error | null;
  tooltipFormatter?: (value: any) => string;
  legendPosition?: 'top' | 'right' | 'bottom' | 'left';
  animate?: boolean;
}

// Helper function to get the appropriate chart component
const getChartComponent = (type: string) => {
  const components = {
    line: LineChart,
    bar: BarChart,
    area: AreaChart,
  };
  return components[type as keyof typeof components] || LineChart;
};

// Helper function to get the appropriate data element component
const getDataComponent = (type: string) => {
  const components = {
    line: Line,
    bar: Bar,
    area: Area,
  };
  return components[type as keyof typeof components] || Line;
};

// Main Chart component
const Chart: React.FC<ChartProps> = React.memo(({
  data,
  type = 'line',
  height = DEFAULT_HEIGHT,
  series,
  xAxis,
  yAxis,
  onDataPointClick,
  loading = false,
  error = null,
  tooltipFormatter,
  legendPosition = 'bottom',
  animate = true,
}) => {
  const theme = useTheme();

  // Memoized chart styles based on theme
  const chartStyles = useMemo(() => ({
    fontSize: theme.typography.body2.fontSize,
    fontFamily: theme.typography.fontFamily,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
  }), [theme]);

  // Memoized grid styles
  const gridStyles = useMemo(() => ({
    strokeDasharray: '3 3',
    stroke: theme.palette.divider,
  }), [theme]);

  // Memoized axis styles
  const axisStyles = useMemo(() => ({
    stroke: theme.palette.text.secondary,
    fontSize: theme.typography.caption.fontSize,
  }), [theme]);

  // Handle loading and error states
  if (loading) {
    return (
      <Box
        height={height}
        display="flex"
        alignItems="center"
        justifyContent="center"
        bgcolor={theme.palette.background.paper}
      >
        Loading chart data...
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        height={height}
        display="flex"
        alignItems="center"
        justifyContent="center"
        color="error.main"
        bgcolor={theme.palette.background.paper}
      >
        Error loading chart: {error.message}
      </Box>
    );
  }

  // Get appropriate chart components
  const ChartComponent = getChartComponent(type);
  const DataComponent = getDataComponent(type);

  return (
    <Box
      height={height}
      width="100%"
      role="img"
      aria-label={`${type} chart visualization`}
      sx={chartStyles}
    >
      <ResponsiveContainer aspect={RESPONSIVE_CONTAINER_ASPECT}>
        <ChartComponent
          data={data}
          margin={CHART_MARGIN}
          onClick={onDataPointClick}
        >
          <CartesianGrid {...gridStyles} />
          
          <XAxis
            {...axisStyles}
            dataKey={xAxis.dataKey}
            label={{ value: xAxis.label, position: 'bottom' }}
            tickFormatter={xAxis.tickFormatter}
            interval={xAxis.interval || 'preserveStartEnd'}
          />
          
          <YAxis
            {...axisStyles}
            label={{ value: yAxis.label, angle: -90, position: 'insideLeft' }}
            tickFormatter={yAxis.tickFormatter}
            domain={yAxis.domain || ['auto', 'auto']}
          />
          
          <Tooltip
            formatter={tooltipFormatter}
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: theme.shape.borderRadius,
            }}
          />
          
          <Legend
            layout={legendPosition === 'left' || legendPosition === 'right' ? 'vertical' : 'horizontal'}
            verticalAlign={legendPosition === 'top' ? 'top' : 'bottom'}
            align="center"
            wrapperStyle={{
              paddingTop: legendPosition === 'bottom' ? '20px' : '0',
            }}
          />
          
          {series.map((s) => (
            <DataComponent
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color || theme.palette.primary.main}
              fill={type === 'area' ? s.color || theme.palette.primary.main : undefined}
              fillOpacity={type === 'area' ? 0.3 : 1}
              isAnimationActive={animate}
              animationDuration={ANIMATION_DURATION}
              dot={type === 'line'}
              activeDot={{ r: 8 }}
            />
          ))}
        </ChartComponent>
      </ResponsiveContainer>
    </Box>
  );
});

Chart.displayName = 'Chart';

export default Chart;