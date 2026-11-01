import { OpsOrderDetail, OrdersBoard } from './Orders';
import { Dispatch, PickList, Pos } from './Floor';

export default function Ops({ page }: { page: 'orders' | 'order' | 'picklist' | 'dispatch' | 'pos' }) {
  switch (page) {
    case 'orders':
      return <OrdersBoard />;
    case 'order':
      return <OpsOrderDetail />;
    case 'picklist':
      return <PickList />;
    case 'dispatch':
      return <Dispatch />;
    case 'pos':
      return <Pos />;
  }
}
