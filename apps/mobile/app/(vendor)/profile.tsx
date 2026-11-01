import { useQuery } from '@tanstack/react-query';
import { qk } from '@sabjiilelo/api-client';
import { api } from '../../lib/api';
import { StaffProfile } from '../../components/StaffProfile';
import { Card, T } from '../../components/ui';

export default function VendorProfile() {
  const q = useQuery({ queryKey: qk.vendorProfile, queryFn: api.vendor.profile });
  const v = q.data;
  return (
    <StaffProfile>
      {v && (
        <Card style={{ marginTop: 12 }}>
          <T v="h3">{v.businessName}</T>
          {v.gstin && <T v="small">GSTIN {v.gstin}</T>}
          {v.upiId && <T v="small">UPI {v.upiId}</T>}
          {v.bankAccount && (
            <T v="small">
              Bank {v.bankAccount} {v.ifsc ? `· ${v.ifsc}` : ''}
            </T>
          )}
          <T v="tiny" style={{ marginTop: 6 }}>
            To change payout details, contact your area admin.
          </T>
        </Card>
      )}
    </StaffProfile>
  );
}
