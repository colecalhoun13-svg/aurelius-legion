import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BackgroundWreath from "../../components/layout/BackgroundWreath";

export default function AureliusChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full h-screen flex bg-aurelius-bg text-aurelius-text">
      <BackgroundWreath />

      <div className="relative z-10 flex w-full">
        <Sidebar />

        <div className="flex flex-col flex-1">
          <TopBar />

          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
