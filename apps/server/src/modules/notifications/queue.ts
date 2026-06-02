import { Queue } from "bullmq";
import { getRedisConnectionOptions } from "./redis.js";
import type { DeliveryJob, EventFanoutJob } from "./types.js";

const prefix = process.env.NOTIFICATION_QUEUE_PREFIX || "skerp";

export const notificationFanoutQueue = new Queue<
  EventFanoutJob,
  unknown,
  "fanout"
>(
  "notification-fanout",
  {
    connection: getRedisConnectionOptions(),
    prefix,
  }
);

export const notificationDeliveryQueue = new Queue<
  DeliveryJob,
  unknown,
  "deliver"
>(
  "notification-delivery",
  {
    connection: getRedisConnectionOptions(),
    prefix,
  }
);

export const enqueueNotificationEvent = async (eventId: string) => {
  await notificationFanoutQueue.add(
    "fanout",
    { eventId },
    {
      jobId: eventId,
      attempts: 5,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 1_000,
    }
  );
};

export const enqueueNotificationDelivery = async (deliveryId: string) => {
  await notificationDeliveryQueue.add(
    "deliver",
    { deliveryId },
    {
      jobId: deliveryId,
      attempts: 5,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 1_000,
    }
  );
};
