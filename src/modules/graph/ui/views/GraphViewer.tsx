"use client";

import { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import NodeDetailsCard from '../components/NodeDetailsCard';
import { Loader2Icon } from 'lucide-react';

type GraphNode = {
    id: string;
    label: string;
    color: string;
    x?: number;
    y?: number;
    [key: string]: any;
};

type GraphLink = {
    source: string;
    target: string;
};

export default function GraphViewer({ highlightIds = [] }: { highlightIds?: string[] }) {
    const graphRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [graphData, setGraphData] = useState<{ nodes: GraphNode[], links: GraphLink[] }>({
        nodes: [],
        links: []
    });

    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null); // 🔥 NEW
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isLoading, setIsLoading] = useState(false);

    // Load graph
    useEffect(() => {
        setIsLoading(true);

        fetch('/api/graph')
            .then(res => res.json())
            .then(data => {
                setGraphData({
                    nodes: data.nodes.map((n: any) => ({
                        ...n,
                        id: String(n.id)
                    })),
                    links: data.links.map((l: any) => ({
                        source: String(l.source),
                        target: String(l.target)
                    }))
                });
            })
            .finally(() => {
                setIsLoading(false);
            });

    }, []);

    // Resize
    useEffect(() => {
        const resize = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                });
            }
        };

        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    // Mouse tracking
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({
                x: e.clientX,
                y: e.clientY
            });
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    const highlightSet = new Set(highlightIds.map(String));

    // 🔥 AUTO SELECT NODE WHEN SEARCHED
    useEffect(() => {
        if (!highlightIds.length) {
            setSelectedNode(null);
            return;
        }

        const node = graphData.nodes.find(n =>
            highlightSet.has(String(n.id))
        );

        if (node) {
            setSelectedNode(node);

            if (node.x && node.y) {
                graphRef.current.centerAt(node.x, node.y, 600);
                graphRef.current.zoom(3, 800);
            }
        }
    }, [highlightIds, graphData]);

    if (isLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <p className="text-gray-500">Loading graph...</p>
                <Loader2Icon className="animate-spin ml-2 text-gray-500" />
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-full h-full relative">

            <ForceGraph2D
                ref={graphRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}

                nodeCanvasObject={(node: any, ctx, globalScale) => {
                    const isHighlighted = highlightSet.has(String(node.id));

                    const size = (isHighlighted ? 7 : 4) / globalScale;

                    ctx.beginPath();
                    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);

                    ctx.fillStyle = isHighlighted
                        ? '#f59e0b'
                        : highlightSet.size > 0
                            ? '#e5e7eb'
                            : node.color;

                    ctx.fill();
                }}

                linkColor={(link: any) =>
                    highlightSet.has(String(link.source)) ||
                        highlightSet.has(String(link.target))
                        ? '#f59e0b'
                        : '#e5e7eb'
                }

                linkWidth={(link: any) =>
                    highlightSet.has(String(link.source)) ||
                        highlightSet.has(String(link.target))
                        ? 2
                        : 0.5
                }

                onNodeHover={(node: any) => {
                    setHoveredNode(node || null);
                }}

                onNodeClick={(node: any) => {
                    setSelectedNode(node); // 🔥 click also opens panel
                }}
            />

            {/* 🔥 Hover (temporary) */}
            {!selectedNode && (
                <NodeDetailsCard node={hoveredNode} position={mousePos} />
            )}

            {/* 🔥 PERSISTENT PANEL (SEARCH RESULT) */}
            {selectedNode && (
                <NodeDetailsCard node={selectedNode} pinned />
            )}
        </div>
    );
}