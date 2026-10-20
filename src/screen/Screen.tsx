import { useAppState } from "../state/AppState.js";
import Node from "./Node.js";

export default function Screen() {
  const { nodes, selectedNodeId, selectNode } = useAppState();
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  return (
    <div className="screen">
      <nav className="menu panel" aria-label="Nodes">
        <strong>Seraph Zero</strong>
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            aria-pressed={node.id === selectedNodeId}
            onClick={() => selectNode(node.id)}
          >
            {node.label}
          </button>
        ))}
      </nav>
      {selectedNode && (
        <aside className="details panel" aria-label={`${selectedNode.label} details`}>
          <button className="close" type="button" onClick={() => selectNode(null)}>
            Close
          </button>
          <Node content={selectedNode.content} />
        </aside>
      )}
    </div>
  );
}
