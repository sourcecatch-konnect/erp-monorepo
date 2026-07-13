// apps/web/src/features/grn/components/ImageLightbox.tsx

"use client";

import * as React from "react";
import {
  IconChevronLeft,
  IconChevronRight,
  IconExternalLink,
} from "@tabler/icons-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@skerp/ui/components/dialog";

export type LightboxImage = {
  id: string;
  url: string;
  title: string;
  meta?: string;
};

type ImageLightboxProps = {
  open: boolean;
  images: LightboxImage[];
  activeIndex: number;
  onOpenChange: (open: boolean) => void;
  onActiveIndexChange: (index: number) => void;
};

export default function ImageLightbox({
  open,
  images,
  activeIndex,
  onOpenChange,
  onActiveIndexChange,
}: ImageLightboxProps) {
  const currentImage = images[activeIndex];

  const hasMultipleImages = images.length > 1;

  const goPrev = React.useCallback(() => {
    if (!images.length) return;

    onActiveIndexChange(
      activeIndex === 0 ? images.length - 1 : activeIndex - 1
    );
  }, [activeIndex, images.length, onActiveIndexChange]);

  const goNext = React.useCallback(() => {
    if (!images.length) return;

    onActiveIndexChange(
      activeIndex === images.length - 1 ? 0 : activeIndex + 1
    );
  }, [activeIndex, images.length, onActiveIndexChange]);

  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, goPrev, goNext]);

  if (!currentImage) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="truncate text-sm font-medium">
                {currentImage.title}
              </DialogTitle>

              {currentImage.meta ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {currentImage.meta}
                </p>
              ) : null}
            </div>

            <a
              href={currentImage.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center px-6 gap-1 text-xs text-primary hover:underline"
            >
              Open original
              <IconExternalLink size={13} />
            </a>
          </div>
        </DialogHeader>

 <div className="relative flex min-h-[420px] items-center justify-center bg-muted/40">
  <img
    src={currentImage.url}
    alt={currentImage.title}
    className="max-h-[75vh] w-full object-contain"
  />

  {hasMultipleImages ? (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-between px-4">
      <button
        type="button"
        onClick={goPrev}
        className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background/90 shadow-sm transition hover:bg-background"
        aria-label="Previous image"
      >
        <IconChevronLeft size={22} />
      </button>

      <button
        type="button"
        onClick={goNext}
        className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background/90 shadow-sm transition hover:bg-background"
        aria-label="Next image"
      >
        <IconChevronRight size={22} />
      </button>
    </div>
  ) : null}
</div>

        {hasMultipleImages ? (
          <div className="border-t px-4 py-2 text-center text-xs text-muted-foreground">
            {activeIndex + 1} / {images.length}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}