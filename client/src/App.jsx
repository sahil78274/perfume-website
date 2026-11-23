import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { CartProvider } from './context/CartContext';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import StorefrontLayout from './components/StorefrontLayout';

import Home from './pages/Home';
import Shop from './pages/Shop';
import Product from './pages/Product';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import TrackOrder from './pages/TrackOrder';
import Account from './pages/Account';
import Privacy from './pages/Privacy';
import NotFound from './pages/NotFound';

import AdminLogin from './admin/AdminLogin';
import AdminLayout from './admin/AdminLayout';
import Overview from './admin/Overview';
import Orders from './admin/Orders';
import OrderDetail from './admin/OrderDetail';
import Products from './admin/Products';
import Customers from './admin/Customers';
import Inventory from './admin/Inventory';
import Suppliers from './admin/Suppliers';
import Finance from './admin/Finance';
import Settings from './admin/Settings';

/** Storefront subtree — cart + customer session live only here. */
function StorefrontShell() {
  return (
    <CustomerAuthProvider>
      <CartProvider>
        <StorefrontLayout />
      </CartProvider>
    </CustomerAuthProvider>
  );
}

/** Admin subtree — separate session, separate chrome, no storefront UI. */
function AdminShell() {
  return (
    <AdminAuthProvider>
      <Outlet />
    </AdminAuthProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route element={<StorefrontShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:slug" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-confirmation" element={<OrderConfirmation />} />
          <Route path="/track-order" element={<TrackOrder />} />
          <Route path="/account" element={<Account />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route path="/admin" element={<AdminShell />}>
          <Route path="login" element={<AdminLogin />} />
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Overview />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:orderNumber" element={<OrderDetail />} />
            <Route path="products" element={<Products />} />
            <Route path="customers" element={<Customers />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="finance" element={<Finance />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
