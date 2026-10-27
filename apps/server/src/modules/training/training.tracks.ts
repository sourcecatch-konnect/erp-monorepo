import {
  TRAINING_TRACKS,
  type PermissionKey,
  type TrainingTrackAssignment,
  type TrainingTrackView,
} from "@skerp/types";

type RoleTrackRow = { trackKey: string; required: boolean };

/**
 * Which tracks a user sees, and which are required.
 *
 *  - "basics" is always required.
 *  - If an admin has assigned tracks to the role (TrainingRoleTrack rows),
 *    those rows decide; unassigned tracks become optional.
 *  - Otherwise tracks are suggested from permissions (`suggestedFor`). A
 *    system role (Admin) holds every permission, so for it only the admin
 *    track is required — everything else is optional.
 *
 * Steps the user has no permission for are hidden, and a track with no
 * visible steps is left out entirely.
 */
export function resolveTracks(
  has: (key: PermissionKey) => boolean,
  isSystemRole: boolean,
  roleTracks: RoleTrackRow[],
): TrainingTrackView[] {
  const configured = new Map(roleTracks.map((row) => [row.trackKey, row]));

  const views = TRAINING_TRACKS.flatMap((track): TrainingTrackView[] => {
    const stepKeys = track.steps
      .filter((step) => !step.requires || has(step.requires))
      .map((step) => step.key);
    if (stepKeys.length === 0) return [];

    let assignment: TrainingTrackAssignment;
    if (track.key === "basics") {
      assignment = "required";
    } else if (configured.size > 0) {
      assignment = configured.get(track.key)?.required ? "required" : "optional";
    } else if (isSystemRole) {
      assignment = track.key === "admin" ? "required" : "optional";
    } else {
      assignment = track.suggestedFor.some(has) ? "required" : "optional";
    }
    return [{ key: track.key, assignment, stepKeys }];
  });

  return [
    ...views.filter((view) => view.assignment === "required"),
    ...views.filter((view) => view.assignment === "optional"),
  ];
}
