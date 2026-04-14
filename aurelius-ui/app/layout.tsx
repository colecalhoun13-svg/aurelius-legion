import "./globals.css";
import Sidebar from "../components/Sidebar";
import CommandBar from "../components/CommandBar";

export const metadata = {
  title: "Aurelius Cockpit",
  description: "Operator dashboard for Aurelius OS v3.4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <CommandBar />
          <main className="p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
