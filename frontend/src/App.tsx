import React, { useState, useEffect } from 'react';
import Visualizer, { NodeData, LinkData } from './components/Visualizer';
import { ReadDir } from "../wailsjs/go/main/App"; 

function App() {
    //TODO: root_path different for unix and windows system
  const ROOT_PATH = "C:\\Users"; 
  
  const [graphData, setGraphData] = useState<{ nodes: NodeData[]; links: LinkData[] }>({
    nodes: [],
    links: []
  });

  useEffect(() => {
    const rootNode: NodeData = { 
        id: ROOT_PATH, 
        name: "ROOT", 
        type: "folder" 
    };

    setGraphData({
        nodes: [rootNode],
        links: []
    });
  }, []);

    const handleClick = (node: NodeData) => {
        if (node.type !== 'folder') return
        const getId = (item: any) => (typeof item === 'object' ? item.id : item);
        const isAlreadyExpanded = graphData.links.some(link => getId(link.source) === node.id);
        if (isAlreadyExpanded) {
            handleCompress(node)
            return;
        }
        else {
            handleExpand(node)
        }
        
  }
    const handleCompress = (node: NodeData) => {
        const getId = (item: any) => (typeof item === 'object' ? item.id : item);
    
        const getDescendants = (parentId: string, links: LinkData[]): string[] => {
            let childrenIds: string[] = [];
    
            const directChildren = links
                .filter(link => getId(link.source) === parentId)
                .map(link => getId(link.target));
    
            childrenIds = [...directChildren];
    
            directChildren.forEach(childId => {
                childrenIds = [...childrenIds, ...getDescendants(childId, links)];
            });
    
            return childrenIds;
        };
    
        const descendantsToRemove = new Set(getDescendants(node.id, graphData.links));
    
        setGraphData(prev => ({
            nodes: prev.nodes.filter(n => !descendantsToRemove.has(n.id)),
            
            links: prev.links.filter(l => {
                const targetId = getId(l.target);
                const sourceId = getId(l.source);
                return !descendantsToRemove.has(targetId) && !descendantsToRemove.has(sourceId);
            })
        }));
    };
  const handleExpand = async (node: NodeData) => {
    if (node.type !== 'folder') return


    try {
        const files = await ReadDir(node.id);

        if (!files || files.length === 0) {
            return;
        }

        const newNodes: NodeData[] = [];
        const newLinks: LinkData[] = [];

        files.forEach((file: any) => {
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
              onNodeClick={handleClick}
      />
      
      <div style={{ position: 'absolute', top: 20, left: 20, color: '#666', fontFamily: 'monospace', pointerEvents: 'none' }}>
        Current Root: {ROOT_PATH} <br/>
        Click Orange Nodes to Expand.
      </div>
    </div>
  );
}

export default App;