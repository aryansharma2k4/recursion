import React, { useState, useEffect } from 'react';
import Visualizer, { NodeData, LinkData } from './components/Visualizer';
import { ReadDir } from "../wailsjs/go/main/App"; 

function App() {
  // CONFIG: Change this to a valid path on your machine
  // Example Windows: "C:\\Users\\aryan"
  // Example Linux: "/home/aryan"
  const ROOT_PATH = "C:\\Users\\aryan"; 
  
  const [graphData, setGraphData] = useState<{ nodes: NodeData[]; links: LinkData[] }>({
    nodes: [],
    links: []
  });

  // 1. Initialize with Root Node
  useEffect(() => {
    const rootNode: NodeData = { 
        id: ROOT_PATH, 
        name: "HOME", 
        type: "folder" 
    };

    setGraphData({
        nodes: [rootNode],
        links: []
    });
  }, []);

  // 2. Handle Folder Expansion
  const handleExpand = async (node: NodeData) => {
    if (node.type !== 'folder') return; 

    console.log("Expanding:", node.id);

    try {
        // Call Go Backend
        const files = await ReadDir(node.id);

        if (!files || files.length === 0) {
            console.log("Folder is empty");
            return;
        }

        const newNodes: NodeData[] = [];
        const newLinks: LinkData[] = [];

        files.forEach((file: any) => {
            // Check duplicates
            const exists = graphData.nodes.find(n => n.id === file.path);
            
            if (!exists) {
                newNodes.push({
                    id: file.path, 
                    name: file.name,
                    type: file.type === "folder" ? "folder" : "file",
                });

                newLinks.push({
                    source: node.id,
                    target: file.path
                });
            }
        });

        if (newNodes.length > 0) {
            setGraphData(prev => ({
                nodes: [...prev.nodes, ...newNodes],
                links: [...prev.links, ...newLinks]
            }));
        }

    } catch (err) {
        console.error("Failed to read directory:", err);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, overflow: 'hidden', backgroundColor: '#111' }}>
      <Visualizer 
        initialData={graphData} 
        onNodeClick={handleExpand}
      />
      
      <div style={{ position: 'absolute', top: 20, left: 20, color: '#666', fontFamily: 'monospace', pointerEvents: 'none' }}>
        Current Root: {ROOT_PATH} <br/>
        Click Orange Nodes to Expand.
      </div>
    </div>
  );
}

export default App;