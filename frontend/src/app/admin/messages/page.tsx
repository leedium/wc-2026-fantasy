import type { Metadata } from 'next';
import { AdminMessages } from './AdminMessages';

export const metadata: Metadata = {
  title: 'Messages | Admin',
};

export default function AdminMessagesPage() {
  return <AdminMessages />;
}
