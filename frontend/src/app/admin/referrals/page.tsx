import type { Metadata } from 'next';
import { AdminReferrals } from './AdminReferrals';

export const metadata: Metadata = {
  title: 'Referrals | Admin',
};

export default function AdminReferralsPage() {
  return <AdminReferrals />;
}
