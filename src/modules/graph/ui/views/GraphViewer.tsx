"use client";

import { useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import NodeDetailsCard from '../components/NodeDetailsCard';
import { Loader2Icon, Maximize2, RotateCcw } from 'lucide-react';

type GraphNode = {
    id: string;
    label: string;
    color?: string;
    x?: number;
    y?: number;
    [key: string]: any;
};

type GraphLink = {
    source: string;
    target: string;
};

// 🔥 NEW: Color mapping for the complete Order-to-Cash pipeline
const NODE_COLORS: Record<string, string> = {
    Customer: '#8b5cf6',        // Purple
    Product: '#ec4899',         // Pink
    SalesOrder: '#3b82f6',      // Blue
    Delivery: '#06b6d4',        // Cyan
    BillingDocument: '#ef4444', // Red
    JournalEntry: '#10b981',    // Green
    Payment: '#f59e0b',         // Amber
    Default: '#94a3b8'          // Slate Gray fallback
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
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isLoading, setIsLoading] = useState(false);

    // 1. Load graph & Assign Colors
    useEffect(() => {
        setIsLoading(true);

        fetch('/api/graph')
            .then(res => res.json())
            .then(data => {
                setGraphData({
                    nodes: data.nodes.map((n: any) => ({
                        ...n,
                        id: String(n.id),
                        color: NODE_COLORS[n.label] || NODE_COLORS.Default
                    })),
                    links: data.links.map((l: any) => ({
                        source: String(l.source),
                        target: String(l.target)
                    }))
                });
            })
            .catch(err => console.error("Failed to fetch graph:", err))
            .finally(() => {
                setIsLoading(false);
            });
    }, []);

    // 2. Responsive Resize
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

    // 3. Mouse Tracking for Floating Hover Card
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    // Memoize the highlight set for O(1) lookups
    const highlightSet = useMemo(() => new Set(highlightIds.map(String)), [highlightIds]);

    // 4. Auto-Center & Select Node when Chat returns IDs
    useEffect(() => {
        if (!highlightIds.length || graphData.nodes.length === 0) {
            setSelectedNode(null);
            return;
        }

        // Find the first highlighted node
        const nodeToCenter = graphData.nodes.find(n => highlightSet.has(n.id));

        if (nodeToCenter && graphRef.current) {
            setSelectedNode(nodeToCenter);

            // If the physics engine has assigned coordinates, zoom to it
            if (nodeToCenter.x !== undefined && nodeToCenter.y !== undefined) {
                graphRef.current.centerAt(nodeToCenter.x, nodeToCenter.y, 800);
                graphRef.current.zoom(3, 800);
            }
        }
    }, [highlightIds, graphData.nodes]);

    if (isLoading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#fffefc]">
                <Loader2Icon className="animate-spin text-gray-400 mb-2" size={24} />
                <p className="text-sm text-gray-500 font-medium">Rendering Enterprise Graph Engine...</p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-full h-full relative bg-[#fffefc] overflow-hidden">

            {/* Toolbar */}
            <div className="absolute top-4 left-4 z-10 flex gap-2">
                <button
                    onClick={() => graphRef.current?.zoomToFit(400)}
                    className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    title="Zoom to Fit"
                >
                    <Maximize2 size={16} />
                </button>
                <button
                    onClick={() => { setSelectedNode(null); graphRef.current?.zoomToFit(400); }}
                    className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    title="Clear Selection"
                >
                    <RotateCcw size={16} />
                </button>
            </div>

            <ForceGraph2D
                ref={graphRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}

                // CRITICAL FOR LARGE DATASETS: Stop calculating physics after 100 ticks
                cooldownTicks={100}

                nodeCanvasObject={(node: any, ctx, globalScale) => {
                    const isHighlighted = highlightSet.has(String(node.id));
                    const hasHighlights = highlightSet.size > 0;

                    // Base size logic
                    const baseSize = isHighlighted ? 8 : 4;
                    const size = baseSize / globalScale;

                    ctx.beginPath();
                    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);

                    // Dim non-highlighted nodes heavily if a search is active
                    ctx.fillStyle = isHighlighted
                        ? '#f59e0b' // Bright Amber for highlights
                        : hasHighlights
                            ? '#f1f5f9' // Ghostly gray if ignored
                            : node.color; // Standard rainbow mapping

                    ctx.fill();

                    // Add a stroke ring to highlighted nodes to make them pop further
                    if (isHighlighted) {
                        ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
                        ctx.lineWidth = 4 / globalScale;
                        ctx.stroke();
                    }
                }}

                linkColor={(link: any) =>
                    highlightSet.has(String(link.source.id || link.source)) ||
                        highlightSet.has(String(link.target.id || link.target))
                        ? '#0066ff'
                        : '#0050cb'.concat('40')
                }

                linkWidth={(link: any) =>
                    highlightSet.has(String(link.source.id || link.source)) ||
                        highlightSet.has(String(link.target.id || link.target))
                        ? 4
                        : 0.5
                }

                onNodeHover={(node: any) => setHoveredNode(node || null)}

                // Allow user to click a node to pin the card
                onNodeClick={(node: any) => {
                    setSelectedNode(node);
                    graphRef.current.centerAt(node.x, node.y, 600);
                }}

                // Click background to dismiss the pinned card
                onBackgroundClick={() => setSelectedNode(null)}
            />

            {/* 1. Temporary Hover Card (Follows Mouse) */}
            {!selectedNode && hoveredNode && (
                <div style={{ position: 'absolute', left: mousePos.x + 15, top: mousePos.y + 15, pointerEvents: 'none' }}>
                    <NodeDetailsCard node={hoveredNode} />
                </div>
            )}

            {/* 2. Persistent Pinned Card (Search Result or Click) */}
            {selectedNode && (
                <div className="absolute top-4 right-4 z-20 shadow-2xl">
                    <NodeDetailsCard node={selectedNode} pinned={true} onClose={() => setSelectedNode(null)} />
                </div>
            )}
        </div>
    );
}