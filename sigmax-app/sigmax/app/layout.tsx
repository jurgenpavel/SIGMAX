import "./../styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SIGMAX — Calculadora de Capacidad de Proceso",
  description: "Calculadora Six Sigma / Capacidad de Proceso",
  icons: {
    // Asegúrate de que el archivo esté en la carpeta /public
    icon: "/favicon.png", // ← cambia este nombre si tu imagen tiene otro nombre
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
        {/* Si deseas usar varias versiones del icono */}
        <link rel="icon" href="/favicon.png" sizes="any" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body className="bg-white text-gray-900">
        {children}
      </body>
    </html>
  );
}
