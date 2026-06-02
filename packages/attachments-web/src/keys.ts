const all = ["attachments"] as const;

export const attachmentKeys = {
  all,
  byEntity: (entityType: string, entityId: string) =>
    [...all, "by-entity", entityType, entityId] as const,
};
