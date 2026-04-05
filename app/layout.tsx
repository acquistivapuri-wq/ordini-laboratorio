import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: process.env.APP_NAME || "Ordini Laboratorio",
  description: "Gestione ordini laboratorio online"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
