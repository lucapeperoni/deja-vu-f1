import type { Metadata } from "next";
import { Inter, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Box, box? — Quando conviene fermarsi in Formula 1",
  description:
    "Il pilota X doveva fermarsi ai box durante quella Safety Car? Ricostruiamo ~800 decisioni reali delle stagioni 2023-2024, opzioni quantificate e verdetto, per rispondere.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${inter.variable} ${barlowCondensed.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <Header />
        {children}
      </body>
    </html>
  );
}
