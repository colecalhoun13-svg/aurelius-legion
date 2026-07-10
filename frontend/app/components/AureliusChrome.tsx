import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BackgroundWreath from "../../components/layout/BackgroundWreath";

export default function AureliusChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full h-screen bg-black p-3 text-aurelius-text">
      {/* The plaque — everything lives inside a gold frame */}
      <div className="aurelius-app-frame relative w-full h-full flex overflow-hidden">
        <BackgroundWreath />

        <div className="relative z-10 flex w-full">
          <Sidebar />

          <div className="flex flex-col flex-1 min-w-0">
            <TopBar />

            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
