// Shared pagination state for master list pages.

"use client";

import * as React from "react";

export function useMasterPagination(size = 10) {
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);

  React.useEffect(() => {
    setPage(0);
  }, [search]);

  return {
    search,
    setSearch,
    page,
    setPage,
    size,
  };
}
