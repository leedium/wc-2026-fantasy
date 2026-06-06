import type { Metadata } from 'next';
import { AdminPredictionsList } from './AdminPredictionsList';

export const metadata: Metadata = {
  title: 'Predictions | Admin',
};

export default function AdminPredictionsPage() {
  return <AdminPredictionsList />;
}
