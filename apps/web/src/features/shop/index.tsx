import { CategoriesPage, Home } from './Home';
import { CategoryPage, ItemPage, SearchPage } from './Browse';
import { CartPage } from './Cart';
import { CheckoutPage } from './Checkout';
import { OrderDetailPage, OrdersPage } from './Orders';
import { AboutPage, AccountPage, AddressesPage, HelpPage, NotificationsPage, PrivacyPage, ProfilePage, SettingsPage, TermsPage } from './Account';

type Page =
  | 'home'
  | 'categories'
  | 'category'
  | 'search'
  | 'item'
  | 'cart'
  | 'checkout'
  | 'orders'
  | 'order'
  | 'account'
  | 'profile'
  | 'addresses'
  | 'settings'
  | 'help'
  | 'terms'
  | 'privacy'
  | 'about'
  | 'notifications'
  | 'staff-notifications';

export default function Shop({ page }: { page: Page }) {
  switch (page) {
    case 'home':
      return <Home />;
    case 'categories':
      return <CategoriesPage />;
    case 'category':
      return <CategoryPage />;
    case 'search':
      return <SearchPage />;
    case 'item':
      return <ItemPage />;
    case 'cart':
      return <CartPage />;
    case 'checkout':
      return <CheckoutPage />;
    case 'orders':
      return <OrdersPage />;
    case 'order':
      return <OrderDetailPage />;
    case 'account':
      return <AccountPage />;
    case 'profile':
      return <ProfilePage />;
    case 'addresses':
      return <AddressesPage />;
    case 'settings':
      return <SettingsPage />;
    case 'help':
      return <HelpPage />;
    case 'terms':
      return <TermsPage />;
    case 'privacy':
      return <PrivacyPage />;
    case 'about':
      return <AboutPage />;
    case 'notifications':
      return <NotificationsPage />;
    case 'staff-notifications':
      return <NotificationsPage orderBase="/dashboard/orders" />;
  }
}
