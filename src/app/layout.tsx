import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./ledger.css";
import "./themes.css";
import "./studio.css";
import "./typography.css";
import { themeInitScript } from "@/lib/themes";
const jakarta = localFont({
  src: "./fonts/plus-jakarta-sans.woff2",
  variable: "--font-jakarta",
  weight: "400 800",
  display: "swap",
});
const figures = localFont({
  src: "./fonts/oxanium.woff2",
  variable: "--font-figures",
  weight: "400 700",
  display: "swap",
});
const display = localFont({
  src: "./fonts/bricolage-grotesque.woff2",
  variable: "--font-display",
  weight: "400 800",
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
      className={`${jakarta.variable} ${figures.variable} ${display.variable}`}
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
