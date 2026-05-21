"use client";

import { useState } from "react";
import type { State, CreateStateBody } from "@skerp/types";

import { useMaster } from "../_shared/hooks/useMaster";
import MasterFormDialog from "../_shared/MasterFormDialog";
import MasterTable from "../_shared/MasterTable";

export default function StatePage() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<State | null>(null);

  const { data = [], isLoading, create, update, remove } =
    useMaster("state");

  async function handleSubmit(data: CreateStateBody) {
    if (selected) {
      await update.mutateAsync({ id: selected.id, data });
    } else {
      await create.mutateAsync(data);
    }

    setOpen(false);
    setSelected(null);
  }

  if (isLoading) return <p>Loading...</p>;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between">
        <h1 className="text-xl font-bold">States</h1>
      </div>

      {/* TABLE */}
      <MasterTable<State>
        data={data}
        columns={[
          {
            type: "accessor",
            header: "Name",
            accessor: "name",
          },
        ]}
        onAddNew={() => {
          setSelected(null);
          setOpen(true);
        }}
        onEdit={(row) => {
          setSelected(row);
          setOpen(true);
        }}
        onDelete={(id) => remove.mutateAsync(id)}
      />

      {/* DIALOG (IMPORTANT FIX) */}
      <MasterFormDialog
        master="state"
        open={open}
        setOpen={setOpen}
        defaultValues={selected}
        onSubmit={handleSubmit}
      />
    </div>
  );
}