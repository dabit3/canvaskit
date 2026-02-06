import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CanvasKit — Design Editor",
  description: "A browser-based vector design tool inspired by Figma",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const googleFonts = [
    "Inter", "Roboto", "Open+Sans", "Lato", "Montserrat", "Poppins",
    "Raleway", "Nunito", "Playfair+Display", "Merriweather",
    "Source+Sans+Pro", "Ubuntu", "Oswald", "Noto+Sans", "PT+Sans",
    "Roboto+Mono", "Fira+Code", "Space+Grotesk", "DM+Sans", "Work+Sans",
  ];
  const fontsUrl = `https://fonts.googleapis.com/css2?${googleFonts.map(f => `family=${f}:wght@100;200;300;400;500;600;700;800;900`).join("&")}&display=swap`;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={fontsUrl} rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
