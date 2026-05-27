// Render the team1_source / team2_source pair as a debug-friendly subtitle
// alongside a match's id, e.g.:  M74 vs M77  or  1E vs 3-ABCDF  or
// L-M101 vs L-M102. Used in the prediction wizard and read-only bracket so
// admins/users can correlate against the FIFA-published bracket reference.
export const formatSourcePair = (team1Source: string, team2Source: string): string =>
  `${team1Source} vs ${team2Source}`;
