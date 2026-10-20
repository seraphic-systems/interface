import Screen from "./screen/Screen.js";
import { AppStateProvider } from "./state/AppState.js";
import World from "./world/World.js";

export default function App() {
  return (
    <AppStateProvider>
      <main className="app">
        <World />
        <Screen />
      </main>
    </AppStateProvider>
  );
}
