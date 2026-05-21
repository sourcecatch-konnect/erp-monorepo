"use client";

import { useParams } from "next/navigation";
import { MasterKey, masterRegistry } from "@/features/masters/registry";


import { useState } from "react";
import { useMaster } from "@/features/masters/_shared/hooks/useMaster";
import MasterTable from "@/features/masters/_shared/MasterTable";
import MasterFormDialog from "@/features/masters/_shared/MasterFormDialog";

export default function MasterPage() {
  const { master } = useParams<{ master: MasterKey }>();

  const config = masterRegistry[master];
   const relations = {
    states: useMaster("state").data ?? [],
  };
const tableColumns = config.fields.map((field) => {
  if (field.type === "select") {
    const relationKey = field.name.replace("Id", "");

    return {
      type: "render" as const,
      header: field.label,
      render: (row: any) => row[relationKey]?.name ?? "-",
    };
  }

  return {
    type: "accessor" as const,
    header: field.label,
    accessor: field.name,
  };
});
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const { data = [], isLoading, create, update, remove } =
    useMaster(master);

  async function handleSubmit(data: any) {
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

      {/* HEADER (COMMON UI) */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{config.label}</h1>
      </div>

      {/* TABLE (COMMON) */}
      <MasterTable
        data={data}
        columns={tableColumns}
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

      {/* DIALOG (COMMON) */}
      <MasterFormDialog
  master={master}
  open={open}
  setOpen={setOpen}
  defaultValues={selected}
  onSubmit={handleSubmit}
  options={relations}
/>
    </div>
  );
}