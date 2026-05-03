import type { Metadata } from 'next';
import { AdminUserBracket } from './AdminUserBracket';

export const metadata: Metadata = {
  title: 'User Bracket | Admin',
};

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminUserBracket userId={id} />;
}
