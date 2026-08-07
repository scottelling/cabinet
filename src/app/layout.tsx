import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Instrument_Serif, Cardo, Outfit } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeInitializer } from "@/components/layout/theme-initializer";
import { RoomThemeSync } from "@/components/layout/room-theme-sync";
import { LocaleInitializer } from "@/components/layout/locale-initializer";
import { LocaleDirectionProvider } from "@/components/layout/locale-direction-provider";
import { PostHogProvider } from "@/components/analytics/posthog-provider";
import "./globals.css";

// Runs before hydration so RTL/LTR + lang are applied to <html> on first paint.
// Mirrors next-themes' inline-script pattern. Keep this minified-ish; it ships
// inline in every page load.
// Keep the supported set + RTL prefixes in sync with src/i18n/index.ts
// (SUPPORTED_LOCALES, RTL_LOCALE_PREFIXES). Inlined here because this runs
// pre-hydration and can't import from the bundle.
const localeBootstrap = `(function(){try{var S=['en','he','zh-CN','zh-TW'],R=['he','ar','fa','ps','ur'];var l=localStorage.getItem('cabinet-locale');if(S.indexOf(l)<0)l='en';var d=R.indexOf(String(l).toLowerCase().split('-')[0])>=0?'rtl':'ltr';document.documentElement.lang=l;document.documentElement.dir=d;}catch(e){}})();`;

// Move existing browsers onto the Animation Kit once, before first paint.
// Later choices in Appearance are preserved, which also keeps the swap easy
// to undo without rolling back product work.
const appearanceBootstrap = `(function(){try{var K='cabinet-ui-system-version',V='animation-v1',T='cabinet-theme';if(localStorage.getItem(K)!==V){localStorage.setItem(K,V);localStorage.setItem(T,'animation')}if(localStorage.getItem(T)==='animation'){document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-custom-theme','animation')}}catch(e){document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-custom-theme','animation')}})();`;

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-animation-ui",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-logo",
  weight: "400",
  style: "italic",
  subsets: ["latin"],
  display: "swap",
});

// Hebrew-capable serif used for the `cabinet` logo (and any .font-logo
// surface) when the UI is in RTL. Cardo ships italic glyphs for Hebrew so
// the brand mark keeps its handwritten cursive feel.
const cardo = Cardo({
  variable: "--font-logo-rtl",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cabinet",
  description: "AI-first knowledge base and startup OS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${outfit.variable} ${instrumentSerif.variable} ${cardo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: localeBootstrap }} />
        <script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <LocaleInitializer />
          <ThemeInitializer />
          <RoomThemeSync />
          <LocaleDirectionProvider>
            <PostHogProvider>{children}</PostHogProvider>
          </LocaleDirectionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
