import type { Metadata } from 'next';
import { AdminTicketsList } from './AdminTicketsList';

export const metadata: Metadata = {
  title: 'Support | Admin',
};

export default function AdminSupportPage() {
  return <AdminTicketsList />;
}
