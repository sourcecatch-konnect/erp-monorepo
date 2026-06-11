"use client";

import * as React from "react";

type Props = {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  columns?: 1 | 2 | 3;
};

const gridClassByColumns = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
};

export default function FormSection({
  icon,
  title,
  description,
  children,
  columns = 3,
}: Props) {
  return (
    <section className="col-span-full rounded-lg border bg-muted/20 p-4">
      <header className="mb-3 flex items-start gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>

      <div className={`grid gap-3 ${gridClassByColumns[columns]}`}>
        {children}
      </div>
    </section>
  );
}
