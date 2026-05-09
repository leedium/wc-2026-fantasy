import type { Metadata } from 'next';

import { AdvancersForm } from './AdvancersForm';

export const metadata: Metadata = {
  title: 'Best-3rd advancers | Admin',
};

export default function AdvancersPage() {
  return <AdvancersForm />;
}
