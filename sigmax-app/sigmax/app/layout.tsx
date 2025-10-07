import "./../styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SIGMAX — Calculadora de Capacidad de Proceso",
  description: "Calculadora Six Sigma / Capacidad de Proceso",
  icons: {
    icon: "/icon.png", // Tu favicon personalizado
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/icon.png" sizes="any" />
      </head>
      <body className="bg-white text-gray-900">{children}</body>
    </html>
  );
}
