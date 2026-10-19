import {
  TRAINING_LANES,
  TRAINING_STAGES,
  TRAINING_TRACKS,
  type TrainingLane,
  type TrainingLaneKey,
  type TrainingMe,
  type TrainingProgressEntry,
  type TrainingStage,
  type TrainingStageKey,
  type TrainingStep,
  type TrainingTrack,
  type TrainingTrackKey,
  type TrainingTrackView,
} from "@skerp/types";

export const STAGE_BY_KEY = new Map<TrainingStageKey, TrainingStage>(
  TRAINING_STAGES.map((stage) => [stage.key, stage]),
);

export const LANE_BY_KEY = new Map<TrainingLaneKey, TrainingLane>(
  TRAINING_LANES.map((lane) => [lane.key, lane]),
);

export const TRACK_BY_KEY = new Map<string, TrainingTrack>(
  TRAINING_TRACKS.map((track) => [track.key, track]),
);

const STEP_BY_KEY = new Map<string, TrainingStep>(
  TRAINING_TRACKS.flatMap((track) => track.steps.map((step) => [step.key, step] as const)),
);

/** Stages that lead into `key` (the reverse of `next`). */
export const previousStages = (key: TrainingStageKey): TrainingStage[] =>
  TRAINING_STAGES.filter((stage) => stage.next.includes(key));

export type TrackProgress = {
  track: TrainingTrack;
  view: TrainingTrackView;
  steps: TrainingStep[];
  done: number;
  skipped: number;
  /** Done + skipped. */
  finished: number;
  total: number;
  percent: number;
  /** First step not yet done or skipped. */
  current: TrainingStep | undefined;
};

export function trackProgress(
  view: TrainingTrackView,
  progress: Map<string, TrainingProgressEntry>,
): TrackProgress | null {
  const track = TRACK_BY_KEY.get(view.key);
  if (!track) return null;
  const steps = view.stepKeys
    .map((key) => STEP_BY_KEY.get(key))
    .filter((step): step is TrainingStep => step !== undefined);
  const done = steps.filter((step) => progress.get(step.key)?.status === "DONE").length;
  const skipped = steps.filter((step) => progress.get(step.key)?.status === "SKIPPED").length;
  const finished = done + skipped;
  return {
    track,
    view,
    steps,
    done,
    skipped,
    finished,
    total: steps.length,
    percent: steps.length === 0 ? 0 : Math.round((finished / steps.length) * 100),
    current: steps.find((step) => !progress.has(step.key)),
  };
}

export const progressMap = (me: TrainingMe) =>
  new Map(me.progress.map((entry) => [entry.stepKey, entry]));

export const findTrackView = (me: TrainingMe, key: TrainingTrackKey | string) =>
  me.tracks.find((view) => view.key === key);
