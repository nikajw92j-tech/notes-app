import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Inter, Noto_Sans_Georgian, Noto_Serif, Pacifico, Source_Code_Pro } from "next/font/google";
import { Providers } from "@/components/providers";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const notoSerif = Noto_Serif({ subsets: ["latin", "cyrillic"], variable: "--font-noto-serif", display: "swap" });
const sourceCode = Source_Code_Pro({ subsets: ["latin", "cyrillic"], variable: "--font-source-code", display: "swap" });
const georgian = Noto_Sans_Georgian({ subsets: ["georgian"], variable: "--font-georgian", display: "swap" });
const pacifico = Pacifico({ subsets: ["latin"], weight: "400", variable: "--font-pacifico", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Notes", template: "%s · Notes" },
  description: "A fast, private note-taking app with rich text, folders, tags and search.",
  applicationName: "Notes",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F5F8" },
    { media: "(prefers-color-scheme: dark)", color: "#0E121B" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : "en";
  const font = store.get("font")?.value;
  const fontTheme = font === "serif" || font === "mono" ? font : "sans";

  return (
    <html
      lang={locale}
      data-font={fontTheme}
      suppressHydrationWarning
      className={`${inter.variable} ${notoSerif.variable} ${sourceCode.variable} ${georgian.variable} ${pacifico.variable}`}
    >
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
