import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AureliusChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full h-screen flex bg-aurelius-bg text-aurelius-text">
      <Sidebar />

      <div className="flex flex-col flex-1">
        <TopBar />

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
