import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./ledger.css";
import "./themes.css";
import { themeInitScript } from "@/lib/themes";
export const metadata: Metadata = {
  title: "Saldo — Your financial journal",
  description:
    "Your money, thoughtfully organized. Track expenses, budgets, wallets and saving goals.",
  icons: { icon: "/favicon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      data-palette="green"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
