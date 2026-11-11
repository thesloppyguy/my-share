import { HashRouter } from "react-router";
import { AppRoutes } from "@/app/routes";
import { SnapshotProvider } from "@/app/snapshot";

function App() {
  return (
    <HashRouter>
      <SnapshotProvider>
        <AppRoutes />
      </SnapshotProvider>
    </HashRouter>
  );
}

export default App;
