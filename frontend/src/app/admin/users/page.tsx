import type { Metadata } from 'next';
import { AdminUsersList } from './AdminUsersList';

export const metadata: Metadata = {
  title: 'Users | Admin',
};

export default function AdminUsersPage() {
  return <AdminUsersList />;
}
