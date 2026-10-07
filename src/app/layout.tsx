import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./ledger.css";
import "./themes.css";
import "./studio.css";
import "./typography.css";
import { themeInitScript } from "@/lib/themes";
const interfaceFont = localFont({
  src: "../../public/fonts/dm-sans.woff2",
  variable: "--font-interface",
  weight: "400 700",
  display: "swap",
});
const display = localFont({
  src: "../../public/fonts/syne.woff2",
  variable: "--font-display",
  weight: "500 800",
  display: "swap",
});
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
      className={`${interfaceFont.variable} ${display.variable}`}
      data-theme="dark"
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
