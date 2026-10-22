"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MyFeedbackItem } from "@skerp/types";
import { feedbackKeys } from "../feedback.keys";
import { feedbackApi } from "../feedback.service";

/**
 * B8 — "has anything happened to my feedback since I last looked?" The
 * last-looked time is a per-browser convenience (localStorage); if storage is
 * unavailable the dot simply shows a little more often.
 */
const KEY = "skerp:feedback-seen-at";
const EVENT = "skerp:feedback-seen";

export const readSeenAt = (): number => {
  try {
    return Number(window.localStorage.getItem(KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
};

export const markFeedbackSeen = () => {
  try {
    window.localStorage.setItem(KEY, String(Date.now()));
  } catch {
    // ignore — see above
  }
  window.dispatchEvent(new Event(EVENT));
};

/** Changed after it was sent (status, team reply…) and after the user last looked. */
export const isUpdatedSince = (item: MyFeedbackItem, seenAt: number) => {
  const updated = new Date(item.updatedAt).getTime();
  return updated > seenAt && updated - new Date(item.createdAt).getTime() > 1000;
};

export function useFeedbackUpdates(enabled: boolean) {
  const { data } = useQuery({
    queryKey: feedbackKeys.mine,
    queryFn: feedbackApi.mine,
    enabled,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const [seenAt, setSeenAt] = useState(0);

  useEffect(() => {
    setSeenAt(readSeenAt());
    const onSeen = () => setSeenAt(readSeenAt());
    window.addEventListener(EVENT, onSeen);
    return () => window.removeEventListener(EVENT, onSeen);
  }, []);

  return (data ?? []).filter((item) => isUpdatedSince(item, seenAt)).length;
}
