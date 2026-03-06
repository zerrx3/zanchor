import "./globals.css";

export const metadata = {
  title: "Zanchor | Portfolio",
  description: "Personal portfolio",
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
      </body>
    </html>
  );
}
