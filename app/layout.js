import "./globals.css";

export const metadata = {
  title: "Rent Management",
  description: "Rent Management App",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-100">
        {children}
      </body>
    </html>
  );
}

