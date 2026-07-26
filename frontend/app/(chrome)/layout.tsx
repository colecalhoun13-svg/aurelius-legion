// One chrome for every page. The route group guarantees no destination can
// ever render without the sidebar/topbar again (five pages shipped that way
// once — nav dead-ends a non-technical user can't escape).
import AureliusChrome from "../components/AureliusChrome";

export default function ChromeLayout({ children }: { children: React.ReactNode }) {
  return <AureliusChrome>{children}</AureliusChrome>;
}
