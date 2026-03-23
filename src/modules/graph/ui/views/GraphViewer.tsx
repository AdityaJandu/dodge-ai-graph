"use client";

import { useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import NodeDetailsCard from '../components/NodeDetailsCard';
import { Maximize2, RotateCcw, X } from 'lucide-react';
import LoadingState from "@/components/self/LoadingState";


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

// 🔥 UPDATED: Added Plant to the color mapping
const NODE_COLORS: Record<string, string> = {
    Customer: '#8b5cf6',        // Purple
    Product: '#ec4899',         // Pink
    Plant: '#14b8a6',           // Teal
    SalesOrder: '#3b82f6',      // Blue
    Delivery: '#06b6d4',        // Cyan
    BillingDocument: '#ef4444', // Red
    JournalEntry: '#10b981',    // Green
    Payment: '#f59e0b',         // Amber
    Default: '#94a3b8'          // Slate Gray fallback
};

const NODE_LEGEND: Array<{ label: string; color: string }> = [
    { label: 'Customer', color: NODE_COLORS.Customer },
    { label: 'Product', color: NODE_COLORS.Product },
    { label: 'Plant', color: NODE_COLORS.Plant },
    { label: 'SalesOrder', color: NODE_COLORS.SalesOrder },
    { label: 'Delivery', color: NODE_COLORS.Delivery },
    { label: 'BillingDocument', color: NODE_COLORS.BillingDocument },
    { label: 'JournalEntry', color: NODE_COLORS.JournalEntry },
    { label: 'Payment', color: NODE_COLORS.Payment }
];

const formatLabel = (label: string) => label.replace(/([A-Z])/g, ' $1').trim();

export default function GraphViewer({
    highlightIds = [],
    onClearHighlights
}: {
    highlightIds?: string[];
    onClearHighlights?: () => void;
}) {
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
    const HOVER_CARD_WIDTH = 320;
    const HOVER_CARD_HEIGHT = 260;
    const HOVER_CARD_OFFSET = 15;

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
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();

            const relativeX = e.clientX - rect.left;
            const relativeY = e.clientY - rect.top;

            const clampedX = Math.max(
                8,
                Math.min(relativeX + HOVER_CARD_OFFSET, rect.width - HOVER_CARD_WIDTH - 8)
            );
            const clampedY = Math.max(
                8,
                Math.min(relativeY + HOVER_CARD_OFFSET, rect.height - HOVER_CARD_HEIGHT - 8)
            );

            setMousePos({ x: clampedX, y: clampedY });
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    // Memoize the highlight set for O(1) rendering lookups
    const highlightSet = useMemo(() => new Set(highlightIds.map(String)), [highlightIds]);

    // 4. Auto-Center & Select Node when Chat returns IDs
    // FIXED: Safe dependency array to prevent Next.js crashes
    useEffect(() => {
        if (!highlightIds.length || graphData.nodes.length === 0) {
            setSelectedNode(null);
            return;
        }

        const nodeToCenter = graphData.nodes.find(n => highlightIds.includes(String(n.id)));

        if (nodeToCenter && graphRef.current) {
            setSelectedNode(nodeToCenter);

            if (nodeToCenter.x !== undefined && nodeToCenter.y !== undefined) {
                graphRef.current.centerAt(nodeToCenter.x, nodeToCenter.y, 800);
                graphRef.current.zoom(3, 800);
            }
        }
    }, [highlightIds, graphData]);

    if (isLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <LoadingState title="Loading Enterprise Graph Engine..." descr="Please wait while we load the graph..." />
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-full h-full relative bg-[#fffefc] overflow-hidden">

            {/* TOOLBAR WITH CLEAR BUTTON */}
            <div className="absolute top-4 left-4 z-10 flex gap-2 items-center">
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

                {highlightIds.length > 0 && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNode(null);
                            if (onClearHighlights) onClearHighlights();
                            graphRef.current?.zoomToFit(400);
                        }}
                        className="ml-2 bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 animate-in fade-in zoom-in duration-200"
                    >
                        <X size={14} strokeWidth={3} /> Clear Search Results
                    </button>
                )}
            </div>

            <ForceGraph2D
                ref={graphRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}

                cooldownTicks={100}

                nodeCanvasObject={(node: any, ctx, globalScale) => {
                    const isHighlighted = highlightSet.has(String(node.id));
                    const hasHighlights = highlightSet.size > 0;

                    const baseSize = isHighlighted ? 8 : 4;
                    const size = baseSize / globalScale;

                    ctx.beginPath();
                    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);

                    ctx.fillStyle = isHighlighted
                        ? '#0066ff' // Match your custom link highlight color
                        : hasHighlights
                            ? '#f1f5f9'
                            : node.color;

                    ctx.fill();

                    if (isHighlighted) {
                        ctx.strokeStyle = 'rgba(0, 102, 255, 0.4)';
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
                        ? 4 / (graphRef.current?.zoom() || 1) // Keeps thick links from taking over screen when zoomed
                        : 0.5
                }

                onNodeHover={(node: any) => setHoveredNode(node || null)}

                onNodeClick={(node: any) => {
                    setSelectedNode(node);
                    graphRef.current.centerAt(node.x, node.y, 600);
                }}

                onBackgroundClick={() => setSelectedNode(null)}
            />

            <div className="absolute bottom-6 left-4 z-10 w-[340px] rounded-2xl border border-gray-200/90 bg-transparent backdrop-blur-lg shadow-md">
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-gray-100">
                    <p className="text-[11px] font-semibold tracking-wide text-gray-700 uppercase">
                        Graph Legend
                    </p>
                    <span className="text-[10px] text-gray-500">{NODE_LEGEND.length} types</span>
                </div>

                <div className="p-3 flex flex-wrap gap-2">
                    {NODE_LEGEND.map((item) => (
                        <div
                            key={item.label}
                            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-transparent px-2.5 py-1 text-[11px] text-gray-700"
                        >
                            <span
                                className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-white"
                                style={{ backgroundColor: item.color }}
                            />
                            <span className="font-medium text-gray-800 leading-none">
                                {formatLabel(item.label)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {!selectedNode && hoveredNode && (
                <div style={{ position: 'absolute', left: mousePos.x, top: mousePos.y, pointerEvents: 'none' }}>
                    <NodeDetailsCard node={hoveredNode} />
                </div>
            )}

            {selectedNode && (
                <NodeDetailsCard node={selectedNode} pinned={true} onClose={() => setSelectedNode(null)} />
            )}
        </div>
    );
}