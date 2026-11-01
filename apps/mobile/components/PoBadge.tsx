import type { PoStatus } from '@sabjiilelo/shared';
import { Badge } from './ui';

const TONE: Record<PoStatus, 'blue' | 'green' | 'orange' | 'red' | 'gray'> = {
  SENT: 'blue',
  ACCEPTED: 'green',
  ADJUSTED: 'orange',
  REJECTED: 'red',
  RECEIVED: 'green',
  CLOSED: 'gray',
};

export const PoBadge = ({ status }: { status: PoStatus }) => <Badge label={status === 'SENT' ? 'new' : status.toLowerCase()} tone={TONE[status]} />;
