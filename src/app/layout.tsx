import type { Metadata } from "next";
import { Courier_Prime, Geist, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
const courierPrime = Courier_Prime({ variable: "--font-courier-prime", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Whoosh",
  description:
    "A cultural reference check for anything you say out loud. Know which references your audience will get before you're on stage, built on Qloo's taste graph.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${instrumentSerif.variable} ${courierPrime.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
