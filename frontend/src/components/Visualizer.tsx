import React, { useState, useEffect, useRef } from 'react';
import { Stage, Container, Graphics, Text } from '@pixi/react';
import * as PIXI from 'pixi.js';
import * as d3 from 'd3';

// --- 1. DEFINING THE SHAPES (INTERFACES) ---
export interface NodeData extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: 'folder' | 'file';
}

export interface LinkData extends d3.SimulationLinkDatum<NodeData> {
  source: string | NodeData;
  target: string | NodeData;
}

interface VisualizerProps {
  initialData: {
    nodes: NodeData[];
    links: LinkData[];
  } | null;
  // This function is called when a user clicks a node
  onNodeClick: (node: NodeData) => void;
}

const BLACK_BG = 0x111111;
const LINK_COLOR = 0x555555;
const NODE_RADIUS = 20;

const TEXT_STYLE = new PIXI.TextStyle({
  fill: '#ffffff',
  fontSize: 12,
  fontFamily: 'monospace',
});

// --- 2. THE MAIN COMPONENT ---
const Visualizer: React.FC<VisualizerProps> = ({ initialData, onNodeClick }) => {
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [links, setLinks] = useState<LinkData[]>([]);
  const [, setTick] = useState(0);

  const simulation = useRef<d3.Simulation<NodeData, LinkData> | null>(null);

  // --- SETUP SIMULATION ---
  useEffect(() => {
    setDimensions({ width: window.innerWidth, height: window.innerHeight });

    simulation.current = d3.forceSimulation<NodeData, LinkData>()
      .force('charge', d3.forceManyBody().strength(-300))
      .force('link', d3.forceLink<NodeData, LinkData>().id((d) => d.id).distance(100))
      .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
      .force('collide', d3.forceCollide(NODE_RADIUS + 10));

    const handleResize = () => {
        setDimensions({ width: window.innerWidth, height: window.innerHeight });
        simulation.current?.force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2));
        simulation.current?.alpha(0.3).restart();
    };
    
    window.addEventListener('resize', handleResize);
    
    simulation.current.on('tick', () => {
       setTick(t => t + 1);
    });

    return () => {
        simulation.current?.stop();
        window.removeEventListener('resize', handleResize);
    };
  }, []);

  // --- UPDATE DATA ---
  useEffect(() => {
    if (!initialData || !simulation.current) return;

    // IMPORTANT: D3 mutates data, so we must clone existing state to avoid React errors
    // But we must NOT clone already-simulation-bound nodes (to keep x/y positions)
    
    // Simple strategy: Merge new data into existing simulation nodes
    const existingNodesMap = new Map(nodes.map(n => [n.id, n]));
    
    const newNodes = initialData.nodes.map(n => {
        // If we already have this node, keep its position (x,y,vx,vy)
        if (existingNodesMap.has(n.id)) {
            return existingNodesMap.get(n.id)!;
        }
        // If it's new, D3 will assign a start position
        return { ...n };
    });

    const newLinks = initialData.links.map(l => ({ ...l }));

    setNodes(newNodes);
    setLinks(newLinks);

    simulation.current.nodes(newNodes);
    
    const linkForce = simulation.current.force('link') as d3.ForceLink<NodeData, LinkData>;
    if (linkForce) {
        linkForce.links(newLinks);
    }
    
    simulation.current.alpha(1).restart();
  }, [initialData]);

  return (
    <Stage 
      width={dimensions.width} 
      height={dimensions.height} 
      options={{ backgroundColor: BLACK_BG, antialias: true }}
    >
      <Graphics
        draw={(g) => {
          g.clear();
          g.lineStyle(2, LINK_COLOR, 1);
          links.forEach((link) => {
            const source = link.source as NodeData;
            const target = link.target as NodeData;
            
            if (source.x !== undefined && source.y !== undefined && target.x !== undefined && target.y !== undefined) {
              g.moveTo(source.x, source.y);
              g.lineTo(target.x, target.y);
            }
          });
        }}
      />

      {nodes.map((node) => (
        <DraggableNode 
          key={node.id} 
          node={node} 
          simulation={simulation.current}
          onNodeClick={onNodeClick}
        />
      ))}
    </Stage>
  );
};

// --- 3. SUB-COMPONENT FOR DRAGGING ---
interface DraggableNodeProps {
    node: NodeData;
    simulation: d3.Simulation<NodeData, LinkData> | null;
    onNodeClick: (node: NodeData) => void;
}

const DraggableNode: React.FC<DraggableNodeProps> = ({ node, simulation, onNodeClick }) => {
  const isDragging = useRef(false);

  const onDragStart = () => {
    isDragging.current = true;
    if (simulation) {
        simulation.alphaTarget(0.3).restart();
        node.fx = node.x;
        node.fy = node.y;
    }
  };

  const onDragMove = (e: any) => {
    if (isDragging.current) {
      const newPosition = e.data ? e.data.global : e.global; 
      node.fx = newPosition.x;
      node.fy = newPosition.y;
    }
  };

  const onDragEnd = () => {
    isDragging.current = false;
    if (simulation) {
        simulation.alphaTarget(0);
        node.fx = null;
        node.fy = null;
    }
  };

  const handleTap = () => {
      // Only fire click if not dragging
      onNodeClick(node);
  }

  return (
    <Container
      x={node.x || 0}
      y={node.y || 0}
      eventMode="static"
      onpointerdown={onDragStart}
      onpointermove={onDragMove}
      onpointerup={onDragEnd}
      onpointerupoutside={onDragEnd}
      onpointertap={handleTap} // Tap/Click event
      cursor="pointer"
    >
      <Graphics
        draw={(g) => {
          g.clear();
          const color = node.type === 'folder' ? 0xFFA500 : 0x00AAFF;
          g.beginFill(color);
          g.drawCircle(0, 0, NODE_RADIUS);
          g.endFill();
        }}
      />
      <Text 
        text={node.name} 
        anchor={0.5} 
        y={NODE_RADIUS + 5} 
        style={TEXT_STYLE} 
      />
    </Container>
  );
};

export default Visualizer;