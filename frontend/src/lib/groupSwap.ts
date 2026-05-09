import type { GroupPrediction } from '@/types/tournament';
import type { GroupPositionKey } from '@/components/predictions/GroupStageForm';

/**
 * Apply a single group-position change with conflict-swap semantics:
 * if `teamId` is already in another slot of the same group, that slot
 * inherits whatever was previously in `position`. Returns a new
 * `GroupPrediction[]` (does not mutate input).
 */
export function applyGroupPositionChange(
  predictions: GroupPrediction[],
  groupId: string,
  position: GroupPositionKey,
  teamId: string | null
): GroupPrediction[] {
  return predictions.map((group) => {
    if (group.groupId !== groupId) return group;
    const positions = { ...group.positions };
    if (teamId) {
      const conflictPos = (Object.keys(positions) as GroupPositionKey[]).find(
        (p) => p !== position && positions[p] === teamId
      );
      if (conflictPos) {
        positions[conflictPos] = positions[position] ?? null;
      }
    }
    positions[position] = teamId;
    return { ...group, positions };
  });
}
