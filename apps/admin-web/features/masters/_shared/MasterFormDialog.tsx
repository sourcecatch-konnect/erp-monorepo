"use client";

import * as React from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@skerp/ui/components/dialog";

import { Input } from "@skerp/ui/components/input";
import { Button } from "@skerp/ui/components/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@skerp/ui/components/select";

import { masterRegistry, MasterKey } from "@/features/masters/registry";

/* ---------------- FORM TYPE ---------------- */

type FormState = Record<string, string>;
type Props = {
  master: MasterKey;
  open: boolean;
  setOpen: (v: boolean) => void;
  defaultValues?: Record<string, any> | null;
  onSubmit: (data: any) => Promise<void>;
  options?: Record<string, any[]>;
};
export default function MasterFormDialog({
  master,
  open,
  setOpen,
  defaultValues,
  onSubmit,
  options = {},
}: Props){
  const config = masterRegistry[master];

  const [form, setForm] = React.useState<FormState>({});

  /* reset form when open */
React.useEffect(() => {
  if (!open) return;

  if (defaultValues) {
    setForm(defaultValues);
    return;
  }

  const empty: FormState = {};
  config.fields.forEach((f) => {
    empty[f.name] = "";
  });

  setForm(empty);
}, [open, defaultValues, config.fields]);


const handleSubmit = async () => {
  await onSubmit(form);
  setOpen(false);
};
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create {config.label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {config.fields.map((field) => {
            /* ---------------- TEXT ---------------- */
            if (field.type === "text") {
              return (
                <Input
                  key={field.name}
                  placeholder={field.label}
                  value={form[field.name] ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      [field.name]: e.target.value,
                    }))
                  }
                />
              );
            }

            /* ---------------- SELECT ---------------- */
       if (field.type === "select") {
  const selectOptions = options?.[field.optionsSource] ?? [];

  return (
    <Select
      key={field.name}
      value={form[field.name] ?? ""}
      onValueChange={(value) =>
        setForm((p) => ({
          ...p,
          [field.name]: value,
        }))
      }
    >
      <SelectTrigger>
        <SelectValue placeholder={field.label} />
      </SelectTrigger>

      <SelectContent>
        {selectOptions.map((opt) => (
          <SelectItem key={opt.id} value={opt.id}>
            {opt.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

            return null;
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>

          <Button onClick={handleSubmit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}