import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import MobileTabBar from "./MobileTabBar";
import BackgroundWreath from "../../components/layout/BackgroundWreath";

// Desktop: the gold plaque frame with the full sidebar.
// Phone (<md): full-bleed, no sidebar — a 5-tab bottom bar carries the day.
// The chrome was the entire mobile problem (fixed 256px sidebar at 390px
// width); the content pages were always single-column and phone-ready.
export default function AureliusChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full h-screen bg-black md:p-3 text-aurelius-text">
      {/* The plaque — a gold frame on desktop, edge-to-edge on the phone
          (the frame's mobile collapse lives in globals.css) */}
      <div className="aurelius-app-frame relative w-full h-full flex overflow-hidden">
        <BackgroundWreath />

        <div className="relative z-10 flex w-full">
          <Sidebar />

          <div className="flex flex-col flex-1 min-w-0">
            <TopBar />

            <main
              className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6"
              style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
            >
              {children}
            </main>
          </div>
        </div>

        <MobileTabBar />
      </div>
    </div>
  );
}
