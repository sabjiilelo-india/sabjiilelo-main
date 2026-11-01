import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Role } from '@sabjiilelo/shared';
import { homeFor, useAuth } from './lib/auth';
import { PageLoader } from './components/ui';
import { ShopLayout } from './layouts/ShopLayout';
import { DashboardLayout } from './layouts/DashboardLayout';

// Each portal is its own chunk so shoppers never download staff screens.
const Shop = lazy(() => import('./features/shop'));
const Auth = lazy(() => import('./features/auth'));
const SuperAdmin = lazy(() => import('./features/superadmin'));
const Admin = lazy(() => import('./features/admin'));
const Ops = lazy(() => import('./features/ops'));
const Supply = lazy(() => import('./features/supply'));
const Accounts = lazy(() => import('./features/accounts'));
const Delivery = lazy(() => import('./features/delivery'));
const VendorPortal = lazy(() => import('./features/vendor'));

const STAFF: Role[] = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'HR', 'DELIVERY', 'VENDOR'];

function RequireRole({ roles, children, loginPath = '/login' }: { roles: Role[]; children: ReactNode; loginPath?: string }) {
  const { status, user } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <PageLoader />;
  if (!user) return <Navigate to={`${loginPath}?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

/** Staff landing: admins and managers get the dashboard, others their main screen. */
function DashboardIndex() {
  const { user } = useAuth();
  if (user?.role === 'ADMIN' || user?.role === 'MANAGER') return <Admin page="dashboard" />;
  return <Navigate to={homeFor(user!.role)} replace />;
}

export function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Auth page="otp" />} />
        <Route path="/admin" element={<Auth page="superadmin" />} />

        <Route
          path="/admin/*"
          element={
            <RequireRole roles={['SUPERADMIN']} loginPath="/admin">
              <DashboardLayout />
            </RequireRole>
          }
        >
          <Route path="overview" element={<SuperAdmin page="overview" />} />
          <Route path="areas" element={<SuperAdmin page="areas" />} />
          <Route path="admins" element={<SuperAdmin page="admins" />} />
          <Route path="*" element={<Navigate to="/admin/overview" replace />} />
        </Route>

        <Route
          path="/dashboard/*"
          element={
            <RequireRole roles={STAFF}>
              <DashboardLayout />
            </RequireRole>
          }
        >
          <Route index element={<DashboardIndex />} />
          <Route path="orders" element={<Ops page="orders" />} />
          <Route path="orders/:id" element={<Ops page="order" />} />
          <Route path="picklist" element={<Ops page="picklist" />} />
          <Route path="dispatch" element={<Ops page="dispatch" />} />
          <Route path="pos" element={<Ops page="pos" />} />
          <Route path="stock" element={<Admin page="stock" />} />
          <Route path="prices" element={<Admin page="prices" />} />
          <Route path="catalog" element={<Admin page="catalog" />} />
          <Route path="catalog/new" element={<Admin page="item" />} />
          <Route path="catalog/:id" element={<Admin page="item" />} />
          <Route path="categories" element={<Admin page="categories" />} />
          <Route path="slots" element={<Admin page="slots" />} />
          <Route path="coupons" element={<Admin page="coupons" />} />
          <Route path="banners" element={<Admin page="banners" />} />
          <Route path="staff" element={<Admin page="staff" />} />
          <Route path="settings" element={<Admin page="settings" />} />
          <Route path="feedback" element={<Admin page="feedback" />} />
          <Route path="hr" element={<Admin page="hr" />} />
          <Route path="supply/demand" element={<Supply page="demand" />} />
          <Route path="supply/pos" element={<Supply page="pos" />} />
          <Route path="supply/pos/:id" element={<Supply page="po" />} />
          <Route path="accounts/cod" element={<Accounts page="cod" />} />
          <Route path="accounts/vendors" element={<Accounts page="vendors" />} />
          <Route path="accounts/refunds" element={<Accounts page="refunds" />} />
          <Route path="accounts/issues" element={<Accounts page="issues" />} />
          <Route path="reports" element={<Accounts page="reports" />} />
          <Route path="deliveries" element={<Delivery page="list" />} />
          <Route path="deliveries/:id" element={<Delivery page="order" />} />
          <Route path="vendor/orders" element={<VendorPortal page="orders" />} />
          <Route path="vendor/orders/:id" element={<VendorPortal page="order" />} />
          <Route path="vendor/rates" element={<VendorPortal page="rates" />} />
          <Route path="vendor/ledger" element={<VendorPortal page="ledger" />} />
          <Route path="notifications" element={<Shop page="notifications" />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>

        <Route path="/" element={<ShopLayout />}>
          <Route index element={<Shop page="home" />} />
          <Route path="category/:id" element={<Shop page="category" />} />
          <Route path="search" element={<Shop page="search" />} />
          <Route path="item/:id" element={<Shop page="item" />} />
          <Route path="cart" element={<Shop page="cart" />} />
          <Route
            path="checkout"
            element={
              <RequireRole roles={['CUSTOMER']}>
                <Shop page="checkout" />
              </RequireRole>
            }
          />
          <Route
            path="orders"
            element={
              <RequireRole roles={['CUSTOMER']}>
                <Shop page="orders" />
              </RequireRole>
            }
          />
          <Route
            path="orders/:id"
            element={
              <RequireRole roles={['CUSTOMER']}>
                <Shop page="order" />
              </RequireRole>
            }
          />
          <Route
            path="account"
            element={
              <RequireRole roles={['CUSTOMER']}>
                <Shop page="account" />
              </RequireRole>
            }
          />
          <Route
            path="notifications"
            element={
              <RequireRole roles={['CUSTOMER']}>
                <Shop page="notifications" />
              </RequireRole>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
