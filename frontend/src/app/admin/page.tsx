import type { Metadata } from 'next';
import { AdminDashboard } from './AdminDashboard';

export const metadata: Metadata = {
  title: 'Admin Dashboard | WC2026',
};

export default function AdminPage() {
  return <AdminDashboard />;
}
