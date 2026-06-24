export const trackingKeys = {
  all: ["tracking"] as const,
  fleet: ["tracking", "fleet"] as const,
  history: (deviceId: number, from: string, to: string) =>
    ["tracking", "history", deviceId, from, to] as const,
};
