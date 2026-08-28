import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import "./admin-fix.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display", weight: ["400", "600"], style: ["normal", "italic"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono-loaded", weight: ["400"] });

export const metadata: Metadata = { title: "Mercury Commerce", description: "Ecommerce operations workspace" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${fraunces.variable} ${inter.variable} ${mono.variable}`}><body>{children}</body></html>;
}
