import { createContext, useContext, useState, type ReactNode } from "react";

export interface WorldNode {
  id: string;
  label: string;
  position: [number, number, number];
  content: string;
}

// Starter data shared by the world and screen. Replace with your own nodes.
const initialNodes: WorldNode[] = [
  {
    id: "welcome",
    label: "Welcome",
    position: [-1.2, 0, 0],
    content: "---\ntitle: Welcome\ntype: note\n---\n# Welcome\n\nSelect a menu item to open its content.",
  },
  {
    id: "ideas",
    label: "Ideas",
    position: [1.2, 0, 0],
    content: "---\ntitle: Ideas\ntags: [world, screen]\n---\n# Ideas\n\n- [x] Share selection between the scene and menus\n- [ ] Build something interesting",
  },
];

interface AppState {
  nodes: WorldNode[];
  selectedNodeId: string | null;
  selectNode: (id: string | null) => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [selectedNodeId, selectNode] = useState<string | null>(null);

  return (
    <AppStateContext.Provider value={{ nodes: initialNodes, selectedNodeId, selectNode }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const state = useContext(AppStateContext);
  if (!state) throw new Error("useAppState must be used inside AppStateProvider.");
  return state;
}
