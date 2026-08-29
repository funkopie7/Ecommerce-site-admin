import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans, Caveat, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", weight: ["500", "700", "800"] });
const body = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600", "700"] });
const sticker = Caveat({ subsets: ["latin"], variable: "--font-sticker", weight: ["600", "700"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono-loaded", weight: ["400"] });

export const metadata: Metadata = { title: "Funkopie Admin", description: "Ecommerce operations workspace" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${display.variable} ${body.variable} ${sticker.variable} ${mono.variable}`}><body>{children}</body></html>;
}
