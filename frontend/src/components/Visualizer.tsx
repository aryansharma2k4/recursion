import React, { useState, useEffect, useRef } from 'react';
import { Stage, Container, Graphics, Text } from '@pixi/react';
import * as PIXI from 'pixi.js';
import * as d3 from 'd3';

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
  onNodeRightClick?: (node: NodeData) => void;
}

const BLACK_BG = 0x111111;
const LINK_COLOR = 0x555555;
const NODE_RADIUS = 20;

const TEXT_STYLE = new PIXI.TextStyle({
  fill: '#ffffff',
  fontSize: 12,
  fontFamily: 'monospace',
});

const Visualizer: React.FC<VisualizerProps> = ({ initialData, onNodeClick, onNodeRightClick }) => {
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [links, setLinks] = useState<LinkData[]>([]);
  const [, setTick] = useState(0);

  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const isPanning = useRef(false);
  const lastPanPosition = useRef({ x: 0, y: 0 });

  const simulation = useRef<d3.Simulation<NodeData, LinkData> | null>(null);

  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    setDimensions({ width: w, height: h });

    setViewport({ x: w / 2, y: h / 2, scale: 1 });

    simulation.current = d3.forceSimulation<NodeData, LinkData>()
      .force('charge', d3.forceManyBody().strength(-300))
      .force('link', d3.forceLink<NodeData, LinkData>().id((d: NodeData) => d.id).distance(100))
      .force('center', d3.forceCenter(0, 0)) 
      .force('collide', d3.forceCollide(NODE_RADIUS + 10));

    const handleResize = () => {
        setDimensions({ width: window.innerWidth, height: window.innerHeight });
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
    if (linkForce) linkForce.links(newLinks);
    
    simulation.current.alpha(1).restart();
  }, [initialData]);


  const handleWheel = (e: React.WheelEvent) => {
    const scaleFactor = 1.001 ** -e.deltaY; 
    const newScale = Math.min(Math.max(viewport.scale * scaleFactor, 0.1), 5);

    const rect = (e.target as Element).getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newX = mouseX - (mouseX - viewport.x) * (newScale / viewport.scale);
    const newY = mouseY - (mouseY - viewport.y) * (newScale / viewport.scale);

    setViewport({ x: newX, y: newY, scale: newScale });
  };

  const onStageDown = (e: any) => {
      isPanning.current = true;
      lastPanPosition.current = { x: e.client.x, y: e.client.y };
  };

  const onStageMove = (e: any) => {
      if (!isPanning.current) return;
      
      const dx = e.client.x - lastPanPosition.current.x;
      const dy = e.client.y - lastPanPosition.current.y;

      setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      lastPanPosition.current = { x: e.client.x, y: e.client.y };
  };

  const onStageUp = () => {
      isPanning.current = false;
  };

  return (
    <div 
        style={{ width: '100vw', height: '100vh', overflow: 'hidden' }} 
        onWheel={handleWheel}
    >
        <Stage 
        width={dimensions.width} 
        height={dimensions.height} 
        options={{ backgroundColor: BLACK_BG, antialias: true, resolution: 2 }}
        onPointerDown={onStageDown}
        onPointerMove={onStageMove}
        onPointerUp={onStageUp}
        onPointerLeave={onStageUp}
        >
        <Container 
            x={viewport.x} 
            y={viewport.y} 
            scale={viewport.scale}
        >
            <Graphics
                draw={(g) => {
                g.clear();
                g.lineStyle(2 / viewport.scale, LINK_COLOR, 1); 
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
                    onNodeRightClick={onNodeRightClick}
                    viewportScale={viewport.scale} 
                />
            ))}
        </Container>
        </Stage>
    </div>
  );
};

interface DraggableNodeProps {
    node: NodeData;
    simulation: d3.Simulation<NodeData, LinkData> | null;
    onNodeClick: (node: NodeData) => void;
    onNodeRightClick?: (node: NodeData) => void;
    viewportScale: number; 
}

const DraggableNode: React.FC<DraggableNodeProps> = ({ node, simulation, onNodeClick, onNodeRightClick, viewportScale }) => {
  const isDragging = useRef(false);

  const onDragStart = (e: any) => {
    e.stopPropagation(); 
    
    isDragging.current = true;
    if (simulation) {
        simulation.alphaTarget(0.3).restart();
        if (node.x !== undefined) node.fx = node.x;
        if (node.y !== undefined) node.fy = node.y;
    }
  };

  const onDragMove = (e: any) => {
    if (isDragging.current) {
      const parent = e.currentTarget.parent; 
      const newPosition = parent.toLocal(e.data.global);

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

  const handleTap = (e: any) => {
      e.stopPropagation(); 
      onNodeClick(node);
  }

  const handleRightClick = (e: any) => {
      e.stopPropagation(); 
      if (onNodeRightClick) onNodeRightClick(node);
  };

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
      onrightclick={handleRightClick}
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
        scale={1} 
      />
    </Container>
  );
};

export default Visualizer;