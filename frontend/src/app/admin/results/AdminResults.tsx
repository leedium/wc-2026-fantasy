'use client';

import { useQuery } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { AdminNav } from '@/components/admin/AdminNav';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GroupStandingsEditor } from './GroupStandingsEditor';
import { KnockoutResultsEditor } from './KnockoutResultsEditor';
import type { Group, KnockoutMatch, Team } from '@/types/tournament';

interface TournamentInfo {
  id: string;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json())?.error ?? res.statusText);
  return res.json();
}

export function AdminResults() {
  const tournament = useQuery<TournamentInfo>({
    queryKey: ['tournament'],
    queryFn: () => fetchJSON('/api/tournament'),
  });
  const groups = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => fetchJSON('/api/groups'),
  });
  const teams = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => fetchJSON('/api/teams'),
  });
  const matches = useQuery<KnockoutMatch[]>({
    queryKey: ['knockout-matches'],
    queryFn: () => fetchJSON('/api/knockout-matches'),
  });

  const ready =
    tournament.data && groups.data && teams.data && matches.data;

  return (
    <PageLayout>
      <h1 className="mb-2 text-3xl font-bold">Admin</h1>
      <AdminNav />
      {!ready ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <Tabs defaultValue="groups">
          <TabsList className="mb-6">
            <TabsTrigger value="groups">Group Standings</TabsTrigger>
            <TabsTrigger value="knockout">Knockout Results</TabsTrigger>
          </TabsList>
          <TabsContent value="groups">
            <GroupStandingsEditor
              tournamentId={tournament.data!.id}
              groups={groups.data!}
            />
          </TabsContent>
          <TabsContent value="knockout">
            <KnockoutResultsEditor
              tournamentId={tournament.data!.id}
              matches={matches.data!}
              teams={teams.data!}
            />
          </TabsContent>
        </Tabs>
      )}
    </PageLayout>
  );
}
