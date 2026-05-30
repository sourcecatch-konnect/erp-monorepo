import { Worker } from "bullmq";
import { getRedisConnectionOptions } from "./redis.js";
import type { DeliveryJob, EventFanoutJob } from "./types.js";
import {
  fanoutNotificationEvent,
  processNotificationDelivery,
} from "./notification.service.js";

const prefix = process.env.NOTIFICATION_QUEUE_PREFIX || "skerp";

export const startNotificationWorkers = () => {
  const fanoutWorker = new Worker<EventFanoutJob>(
    "notification-fanout",
    async (job) => fanoutNotificationEvent(job.data.eventId),
    { connection: getRedisConnectionOptions(), prefix }
  );

  const deliveryWorker = new Worker<DeliveryJob>(
    "notification-delivery",
    async (job) => processNotificationDelivery(job.data.deliveryId),
    { connection: getRedisConnectionOptions(), prefix, concurrency: 5 }
  );

  fanoutWorker.on("failed", (job, error) => {
    console.error("[notifications] Fanout job failed:", job?.id, error);
  });
  deliveryWorker.on("failed", (job, error) => {
    console.error("[notifications] Delivery job failed:", job?.id, error);
  });

  return { fanoutWorker, deliveryWorker };
};
