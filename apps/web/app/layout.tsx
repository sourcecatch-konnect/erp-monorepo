import { Providers } from "./providers";
import { Toaster } from "@skerp/ui/components/sooner";
import { TestModeToggle } from "@/features/dev-tools/TestModeToggle";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <Providers>
          {children}
          <Toaster />
          {process.env.NEXT_PUBLIC_TEST_MODE === "true" && <TestModeToggle />}
        </Providers>
      </body>
    </html>
  );
}
