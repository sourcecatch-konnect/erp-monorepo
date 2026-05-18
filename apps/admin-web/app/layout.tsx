import { Providers } from "./provider";
import "./globals.css"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
    <body className="bg-gray-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}