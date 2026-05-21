"use client";

import { useState } from "react";
import type { City, CreateCityBody } from "@skerp/types";

import MasterTable from "../_shared/MasterTable";
import MasterFormDialog from "../_shared/MasterFormDialog";
import { useMaster } from "../_shared/hooks/useMaster";

export default function CityPage() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<City | null>(null);

  const { data = [], isLoading, create, update, remove } =
    useMaster("city");
    console.log(data,"Cityes")
const { data: states = [] } = useMaster("state");
  async function handleSubmit(data: CreateCityBody) {
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
    <div>
      <h1>Cities</h1>

      {/* TABLE */}
      <MasterTable<City>
        data={data}
        columns={[
          {
            type: "accessor",
            header: "City Name",
            accessor: "name",
          },
          {
            type: "render",
            header: "State",
            render: (row) => row.state?.name,
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

      {/* DIALOG (FIXED) */}
   <MasterFormDialog
  master="city"
  open={open}
  setOpen={setOpen}
  defaultValues={selected}
  onSubmit={handleSubmit}
  options={{
    states,
  }}
/>
    </div>
  );
}