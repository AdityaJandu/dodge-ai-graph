import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/neo4j';

type GraphNode = {
    id: string;
    label: string;
    [key: string]: unknown;
};

type GraphLink = {
    source: string;
    target: string;
    type: string;
};

export async function GET(): Promise<NextResponse> {
    try {
        // Cap relationship count to keep first render snappy.
        const MAX_RELATIONSHIPS = 1200;
        const cypher = `
            MATCH (n)-[r]->(m)
            WITH n, r, m
            LIMIT ${MAX_RELATIONSHIPS}
            RETURN n, r, m
        `;

        const result = await runQuery(cypher);

        const nodesMap = new Map<string, GraphNode>();
        const links: GraphLink[] = [];

        const extractNode = (node: {
            properties?: Record<string, unknown>;
            labels?: string[];
        } | null | undefined): GraphNode | null => {
            const id = node?.properties?.id;
            if (!id) return null;
            return {
                ...node.properties,
                id: String(id),
                label: node?.labels?.[0] || 'Unknown'
            };
        };

        result.forEach((record: { get: (key: string) => unknown }) => {
            const sourceNode = extractNode(record.get('n') as { properties?: Record<string, unknown>; labels?: string[] });
            const targetNode = extractNode(record.get('m') as { properties?: Record<string, unknown>; labels?: string[] });
            const relation = record.get('r') as { type?: string } | undefined;

            if (sourceNode) nodesMap.set(sourceNode.id, sourceNode);
            if (targetNode) nodesMap.set(targetNode.id, targetNode);

            if (sourceNode && targetNode && relation) {
                links.push({
                    source: sourceNode.id,
                    target: targetNode.id,
                    type: relation.type || 'RELATED_TO'
                });
            }
        });

        return NextResponse.json({
            nodes: Array.from(nodesMap.values()),
            links
        });

    } catch (error) {
        console.error("Graph API Error:", error);
        return NextResponse.json({ error: "Failed to fetch graph data" }, { status: 500 });
    }
}