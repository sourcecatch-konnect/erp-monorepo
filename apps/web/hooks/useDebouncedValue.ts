"use client";

import * as React from "react";

/**
 * Returns `value` after it has stopped changing for `delayMs`.
 * App-wide: used by master list search boxes and the sidebar nav search.
 */
export function useDebouncedValue<T>(value: T, delayMs = 400) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debouncedValue;
}
