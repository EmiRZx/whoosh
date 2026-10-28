import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4, Unbounded } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const sourceSerif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"], style: ["normal", "italic"] });
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Whoosh",
  description:
    "A cultural reference check for anything you say out loud. Know which references will fly over your audience's heads before you're on stage, built on Qloo's taste graph.",
};

// Applies a saved theme before the first paint; without one the OS decides.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("whoosh-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} ${unbounded.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
