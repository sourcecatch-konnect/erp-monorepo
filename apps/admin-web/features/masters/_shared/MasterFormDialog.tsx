"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
}: Props) {
  const config = masterRegistry[master];

  const [form, setForm] = React.useState<FormState>({});
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;

    if (defaultValues) {
      setForm(defaultValues);
      return;
    }

    const empty: FormState = {};
    config.fields.forEach((f) => (empty[f.name] = ""));
    setForm(empty);
  }, [open, defaultValues, config.fields]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit(form);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        
        {/* HEADER */}
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-semibold">
            {defaultValues ? "Update" : "Create"} {config.label}
          </DialogTitle>

          <DialogDescription>
            Fill in the details below to continue.
          </DialogDescription>
        </DialogHeader>

        {/* FORM BODY */}
        <div className="grid gap-4 py-4">
          {config.fields.map((field) => (
            <div key={field.name} className="grid gap-1.5">
              
              {/* LABEL */}
              <label className="text-xs font-medium text-muted-foreground">
                {field.label}
              </label>

              {/* INPUT */}
              {field.type === "text" && (
                <Input
                  value={form[field.name] ?? ""}
                  placeholder={`Enter ${field.label}`}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      [field.name]: e.target.value,
                    }))
                  }
                />
              )}

              {/* SELECT */}
              {field.type === "select" && (
                <Select
                  value={form[field.name] ?? ""}
                  onValueChange={(value) =>
                    setForm((p) => ({
                      ...p,
                      [field.name]: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${field.label}`} />
                  </SelectTrigger>

                  <SelectContent>
                    {(options?.[field.optionsSource] ?? []).map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>

          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}