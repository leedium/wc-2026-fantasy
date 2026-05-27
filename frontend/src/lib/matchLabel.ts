// Flip group-seed sources from DB-native `<pos><group>` (`1A`, `2L`) to the
// more readable `<group><pos>` (`A1`, `L2`). Other shapes — match references
// (`M73`, `L-M101`) and 3rd-place placeholders (`3-ABCDF`) — pass through.
export const formatSource = (source: string): string =>
  source.replace(/^(\d)([A-L])$/, '$2$1');

// Render the team1_source / team2_source pair as a debug-friendly subtitle
// alongside a match's id, e.g.:  M74 vs M77  or  E1 vs 3-ABCDF  or
// L-M101 vs L-M102. Used in the prediction wizard and read-only bracket so
// admins/users can correlate against the FIFA-published bracket reference.
export const formatSourcePair = (team1Source: string, team2Source: string): string =>
  `${formatSource(team1Source)} vs ${formatSource(team2Source)}`;
