import {
  IconBuildingBank,
  IconCurrencyRupee,
  IconEye,
  IconShieldCheck,
  IconStack2,
  IconTool,
  IconTrain,
  IconTruck,
  type Icon,
} from "@tabler/icons-react";
import type { TrainingTrackKey } from "@skerp/types";

/**
 * One icon per track, so a track reads as itself in a list of cards.
 * A full Record, so adding a track to the catalog without giving it an icon
 * is a compile error.
 */
export const TRACK_ICONS: Record<TrainingTrackKey, Icon> = {
  basics: IconStack2,
  ops: IconTruck,
  "branch-manager": IconShieldCheck,
  rail: IconTrain,
  accounts: IconCurrencyRupee,
  workshop: IconTool,
  auditor: IconEye,
  admin: IconBuildingBank,
};

/**
 * One learning accent per track, so a grid of track cards reads as distinct
 * subjects rather than eight copies of the same blue card. A full Record for
 * the same reason as TRACK_ICONS: a new track without a tone won't compile.
 */
export const TRACK_TONES: Record<TrainingTrackKey, 1 | 2 | 3 | 4 | 5 | 6> = {
  basics: 1,
  ops: 4,
  "branch-manager": 2,
  rail: 5,
  accounts: 6,
  workshop: 3,
  auditor: 2,
  admin: 1,
};
