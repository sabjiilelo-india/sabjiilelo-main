import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { formatINR } from '@sabjiilelo/shared';
import { api } from '../../lib/api';
import { StaffProfile } from '../../components/StaffProfile';
import { Badge, Card, Row, T, font } from '../../components/ui';

export default function RiderProfile() {
  const cash = useQuery({ queryKey: qk.riderCash(), queryFn: () => api.rider.cash() });
  const c = cash.data;
  return (
    <StaffProfile>
      <Card style={{ marginTop: 12 }}>
        <T v="h3" style={{ marginBottom: 8 }}>
          Today's cash
        </T>
        <Row style={{ justifyContent: 'space-between' }}>
          <T>Collected</T>
          <T style={{ fontFamily: font.semibold }}>{formatINR(c?.codExpectedPaise ?? 0)}</T>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
          <T>Handed to accountant</T>
          <T style={{ fontFamily: font.semibold }}>{formatINR(c?.depositedPaise ?? 0)}</T>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
          <T>Status</T>
          <Badge label={(c?.status ?? 'OPEN').toLowerCase()} tone={c?.status === 'SETTLED' ? 'green' : c?.status === 'SHORT' ? 'red' : 'yellow'} />
        </Row>
      </Card>
    </StaffProfile>
  );
}
