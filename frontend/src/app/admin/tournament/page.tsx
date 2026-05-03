import type { Metadata } from 'next';
import { TournamentSettingsForm } from './TournamentSettingsForm';

export const metadata: Metadata = {
  title: 'Tournament Settings | Admin',
};

export default function AdminTournamentPage() {
  return <TournamentSettingsForm />;
}
