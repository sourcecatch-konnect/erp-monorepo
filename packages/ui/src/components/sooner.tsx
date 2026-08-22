"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",

          // Overrides Sonner's own richColors palette, which defaults to a
          // more saturated/dark tone per type. These are lighter, pastel
          // versions — bg/border/text triplet per type, same convention as
          // --normal-* above. Adjust the hex values to taste; the variable
          // names are fixed (Sonner reads exactly these four names when
          // richColors is on).
          "--success-bg": "#f0fdf4",
          "--success-border": "#dcfce7",
          "--success-text": "#16a34a",

          "--error-bg": "#fef2f2",
          "--error-border": "#fee2e2",
          "--error-text": "#dc2626",

          "--warning-bg": "#fffbeb",
          "--warning-border": "#fef3c7",
          "--warning-text": "#d97706",

          "--info-bg": "#eff6ff",
          "--info-border": "#dbeafe",
          "--info-text": "#2563eb",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }