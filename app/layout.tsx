import type { Metadata } from "next";
import AccessGuard from "@/components/AccessGuard";
import AppNavigation from "@/components/AppNavigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pro Team Max",
  description: "Organización interna de partidos y jugadores de PadelProX",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <AccessGuard>
          <AppNavigation>{children}</AppNavigation>
        </AccessGuard>
      </body>
    </html>
  );
}