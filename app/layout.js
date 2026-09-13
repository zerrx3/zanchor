import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import RegisterSW from "@/components/RegisterSW";

export const metadata = {
  title: "Zanchor | Portfolio",
  description: "Personal portfolio",
  manifest: "/manifest.json",
  icons: {
    icon: ["/icon-192.png", "/icon-512.png"],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Zanchor",
  },
};

export const viewport = {
  themeColor: "#111827",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="[color-scheme:dark] h-full">
      <body className="bg-gray-900 text-white h-full">
        <div className="min-h-screen w-full flex flex-col">
          <main className="flex-1">
            {children}
          </main>
        </div>
        <Analytics />
        <RegisterSW />
      </body>
    </html>
  );
}
