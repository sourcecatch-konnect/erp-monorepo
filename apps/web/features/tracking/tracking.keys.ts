export const trackingKeys = {
  all: ["tracking"] as const,
  fleet: ["tracking", "fleet"] as const,
  history: (assignmentId: string, from: string, to: string) =>
    ["tracking", "history", assignmentId, from, to] as const,
};
