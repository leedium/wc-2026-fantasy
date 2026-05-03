import type { Metadata } from 'next';
import { AdminResults } from './AdminResults';

export const metadata: Metadata = {
  title: 'Results | Admin',
};

export default function AdminResultsPage() {
  return <AdminResults />;
}
