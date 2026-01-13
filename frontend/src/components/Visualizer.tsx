import React, { useState, useEffect, useRef } from 'react';
import { Stage, Container, Graphics, Text } from '@pixi/react';
import * as PIXI from 'pixi.js';
import * as d3 from 'd3';

// --- 1. DEFINING THE SHAPES (INTERFACES) ---
// We explicitly add x, y, fx, fy here to stop TypeScript complaints
export interface NodeData extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: 'folder' | 'file';
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
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

  useEffect(() => {
    // Set initial dimensions
    const w = window.innerWidth;
    const h = window.innerHeight;
    setDimensions({ width: w, height: h });

    simulation.current = d3.forceSimulation<NodeData, LinkData>()
      .force('charge', d3.forceManyBody().strength(-300))
      // EXPLICIT TYPE FIX: (d: NodeData)
      .force('link', d3.forceLink<NodeData, LinkData>().id((d: NodeData) => d.id).distance(100))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collide', d3.forceCollide(NODE_RADIUS + 10));

    const handleResize = () => {
        const newW = window.innerWidth;
        const newH = window.innerHeight;
        setDimensions({ width: newW, height: newH });
        simulation.current?.force('center', d3.forceCenter(newW / 2, newH / 2));
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

  useEffect(() => {
    if (!initialData || !simulation.current) return;

    const existingNodesMap = new Map(nodes.map(n => [n.id, n]));
    
    const newNodes = initialData.nodes.map(n => {
        if (existingNodesMap.has(n.id)) {
            return existingNodesMap.get(n.id)!;
        }
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
            
            // Safe access because we defined x? and y? in the interface
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
        // Safe access to fx/fy/x/y
        if (node.x !== undefined) node.fx = node.x;
        if (node.y !== undefined) node.fy = node.y;
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
      onpointertap={handleTap}
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