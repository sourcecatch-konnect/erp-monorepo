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
