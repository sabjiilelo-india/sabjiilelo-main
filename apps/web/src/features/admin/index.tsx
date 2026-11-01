import { Dashboard } from './Dashboard';
import { PriceBoard, StockBoard } from './Boards';
import { CatalogList, Categories, ItemEditor } from './Catalog';
import { AreaSettings, Banners, Coupons, Slots } from './Config';
import { Feedback, HrHome, Staff } from './Team';

type Page = 'dashboard' | 'stock' | 'prices' | 'catalog' | 'item' | 'categories' | 'slots' | 'coupons' | 'banners' | 'staff' | 'settings' | 'feedback' | 'hr';

export default function Admin({ page }: { page: Page }) {
  switch (page) {
    case 'dashboard':
      return <Dashboard />;
    case 'stock':
      return <StockBoard />;
    case 'prices':
      return <PriceBoard />;
    case 'catalog':
      return <CatalogList />;
    case 'item':
      return <ItemEditor />;
    case 'categories':
      return <Categories />;
    case 'slots':
      return <Slots />;
    case 'coupons':
      return <Coupons />;
    case 'banners':
      return <Banners />;
    case 'staff':
      return <Staff />;
    case 'settings':
      return <AreaSettings />;
    case 'feedback':
      return <Feedback />;
    case 'hr':
      return <HrHome />;
  }
}
