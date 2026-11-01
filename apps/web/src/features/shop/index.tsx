import { Home } from './Home';
import { CategoryPage, ItemPage, SearchPage } from './Browse';
import { CartPage } from './Cart';
import { CheckoutPage } from './Checkout';
import { OrderDetailPage, OrdersPage } from './Orders';
import { AccountPage, NotificationsPage } from './Account';

type Page = 'home' | 'category' | 'search' | 'item' | 'cart' | 'checkout' | 'orders' | 'order' | 'account' | 'notifications';

export default function Shop({ page }: { page: Page }) {
  switch (page) {
    case 'home':
      return <Home />;
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
    case 'notifications':
      return <NotificationsPage />;
  }
}
