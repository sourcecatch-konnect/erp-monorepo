import {
  IconCash,
  IconDatabase,
  IconDots,
  IconDownload,
  IconEye,
  IconPencil,
  IconPlus,
  IconSettings,
  IconShieldLock,
  IconTool,
  IconTrain,
  IconTrash,
  IconTruck,
  IconUpload,
  type Icon,
} from "@tabler/icons-react";

/**
 * Icons for the role editor. Kept out of role-permissions.model.ts so that
 * module stays free of React, and out of the components so the matrix and the
 * checklist can't drift apart on which glyph means "delete".
 */

const GROUP_ICONS: Record<string, Icon> = {
  "Master data": IconDatabase,
  Operations: IconTruck,
  Rail: IconTrain,
  Finance: IconCash,
  Workshop: IconTool,
  Administration: IconShieldLock,
};

export const groupIcon = (group: string): Icon =>
  GROUP_ICONS[group] ?? IconSettings;

const ACTION_ICONS: Record<string, Icon> = {
  view: IconEye,
  create: IconPlus,
  update: IconPencil,
  delete: IconTrash,
  export: IconDownload,
  bulk_import: IconUpload,
};

/** Irregular verbs (approve, cancel, close…) have no glyph of their own. */
export const actionIcon = (action: string): Icon =>
  ACTION_ICONS[action] ?? IconDots;

export const hasActionIcon = (action: string): boolean =>
  action in ACTION_ICONS;
