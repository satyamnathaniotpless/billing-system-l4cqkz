import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
import { CustomerLayout } from '../components/layout/CustomerLayout';
import { AuthLayout } from '../components/layout/AuthLayout';

// Version comments for external dependencies
// react-router-dom: ^6.x
// react: ^18.x

/**
 * Route path constants for type safety and maintainability
 */
export const ROUTES = {
  AUTH: {
    LOGIN: '/login',
    REGISTER: '/register',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password/:token',
    MFA_VERIFY: '/mfa-verify'
  },
  ADMIN: {
    DASHBOARD: '/admin',
    CUSTOMERS: '/admin/customers',
    CUSTOMER_DETAIL: '/admin/customers/:id',
    BILLING: '/admin/billing',
    INVOICES: '/admin/invoices',
    PRICE_PLANS: '/admin/price-plans',
    REPORTS: '/admin/reports',
    SETTINGS: '/admin/settings',
    AUDIT_LOGS: '/admin/audit-logs'
  },
  CUSTOMER: {
    DASHBOARD: '/dashboard',
    INVOICES: '/invoices',
    USAGE: '/usage',
    WALLET: '/wallet',
    PROFILE: '/profile',
    API_KEYS: '/api-keys',
    NOTIFICATIONS: '/notifications'
  }
} as const;

/**
 * Lazy-loaded page components for code splitting
 */
const AuthPages = {
  Login: lazy(() => import('../pages/auth/Login')),
  Register: lazy(() => import('../pages/auth/Register')),
  ForgotPassword: lazy(() => import('../pages/auth/ForgotPassword')),
  ResetPassword: lazy(() => import('../pages/auth/ResetPassword')),
  MfaVerify: lazy(() => import('../pages/auth/MfaVerify'))
};

const AdminPages = {
  Dashboard: lazy(() => import('../pages/admin/Dashboard')),
  Customers: lazy(() => import('../pages/admin/Customers')),
  CustomerDetail: lazy(() => import('../pages/admin/CustomerDetail')),
  Billing: lazy(() => import('../pages/admin/Billing')),
  Invoices: lazy(() => import('../pages/admin/Invoices')),
  PricePlans: lazy(() => import('../pages/admin/PricePlans')),
  Reports: lazy(() => import('../pages/admin/Reports')),
  Settings: lazy(() => import('../pages/admin/Settings')),
  AuditLogs: lazy(() => import('../pages/admin/AuditLogs'))
};

const CustomerPages = {
  Dashboard: lazy(() => import('../pages/customer/Dashboard')),
  Invoices: lazy(() => import('../pages/customer/Invoices')),
  Usage: lazy(() => import('../pages/customer/Usage')),
  Wallet: lazy(() => import('../pages/customer/Wallet')),
  Profile: lazy(() => import('../pages/customer/Profile')),
  ApiKeys: lazy(() => import('../pages/customer/ApiKeys')),
  Notifications: lazy(() => import('../pages/customer/Notifications'))
};

/**
 * Authentication route configuration with security features
 */
export const authRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      { path: ROUTES.AUTH.LOGIN, element: <AuthPages.Login />, index: true },
      { path: ROUTES.AUTH.REGISTER, element: <AuthPages.Register /> },
      { path: ROUTES.AUTH.FORGOT_PASSWORD, element: <AuthPages.ForgotPassword /> },
      { path: ROUTES.AUTH.RESET_PASSWORD, element: <AuthPages.ResetPassword /> },
      { path: ROUTES.AUTH.MFA_VERIFY, element: <AuthPages.MfaVerify /> }
    ]
  }
];

/**
 * Admin routes with role-based access control
 */
export const adminRoutes: RouteObject[] = [
  {
    path: '/admin',
    element: <AdminLayout />,
    meta: {
      requiresAuth: true,
      roles: ['admin', 'super_admin'],
      permissions: ['admin.access']
    },
    children: [
      {
        path: '',
        element: <AdminPages.Dashboard />,
        meta: { permissions: ['admin.dashboard.view'] }
      },
      {
        path: 'customers',
        element: <AdminPages.Customers />,
        meta: { permissions: ['admin.customers.view'] }
      },
      {
        path: 'customers/:id',
        element: <AdminPages.CustomerDetail />,
        meta: { permissions: ['admin.customers.view', 'admin.customers.edit'] }
      },
      {
        path: 'billing',
        element: <AdminPages.Billing />,
        meta: { permissions: ['admin.billing.manage'] }
      },
      {
        path: 'invoices',
        element: <AdminPages.Invoices />,
        meta: { permissions: ['admin.invoices.view'] }
      },
      {
        path: 'price-plans',
        element: <AdminPages.PricePlans />,
        meta: { permissions: ['admin.price-plans.manage'] }
      },
      {
        path: 'reports',
        element: <AdminPages.Reports />,
        meta: { permissions: ['admin.reports.view'] }
      },
      {
        path: 'settings',
        element: <AdminPages.Settings />,
        meta: { permissions: ['admin.settings.manage'] }
      },
      {
        path: 'audit-logs',
        element: <AdminPages.AuditLogs />,
        meta: { permissions: ['admin.audit.view'] }
      }
    ]
  }
];

/**
 * Customer routes with authentication and feature access control
 */
export const customerRoutes: RouteObject[] = [
  {
    path: '/',
    element: <CustomerLayout />,
    meta: {
      requiresAuth: true,
      roles: ['customer'],
      permissions: ['customer.access']
    },
    children: [
      {
        path: ROUTES.CUSTOMER.DASHBOARD,
        element: <CustomerPages.Dashboard />,
        meta: { permissions: ['customer.dashboard.view'] }
      },
      {
        path: ROUTES.CUSTOMER.INVOICES,
        element: <CustomerPages.Invoices />,
        meta: { permissions: ['customer.invoices.view'] }
      },
      {
        path: ROUTES.CUSTOMER.USAGE,
        element: <CustomerPages.Usage />,
        meta: { permissions: ['customer.usage.view'] }
      },
      {
        path: ROUTES.CUSTOMER.WALLET,
        element: <CustomerPages.Wallet />,
        meta: { permissions: ['customer.wallet.manage'] }
      },
      {
        path: ROUTES.CUSTOMER.PROFILE,
        element: <CustomerPages.Profile />,
        meta: { permissions: ['customer.profile.manage'] }
      },
      {
        path: ROUTES.CUSTOMER.API_KEYS,
        element: <CustomerPages.ApiKeys />,
        meta: { permissions: ['customer.api-keys.manage'] }
      },
      {
        path: ROUTES.CUSTOMER.NOTIFICATIONS,
        element: <CustomerPages.Notifications />,
        meta: { permissions: ['customer.notifications.view'] }
      }
    ]
  }
];

/**
 * Combined routes array with route guards and access control
 */
export const routes: RouteObject[] = [
  ...authRoutes,
  ...adminRoutes,
  ...customerRoutes,
  {
    path: '*',
    element: lazy(() => import('../pages/Error404'))
  }
];

export default routes;