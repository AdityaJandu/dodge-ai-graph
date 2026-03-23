import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/neo4j';

export async function GET(): Promise<NextResponse> {
    try {
        // 1. Dynamic Graph Fetch
        // We match ANY relationship to see the full Order-to-Cash flow.
        // LIMIT 400 protects the browser's physics engine from crashing. -> LIMIT 400
        // Rignt now fetching everything for simplicity:
        const cypher = `
            MATCH (n)-[r]->(m)
            RETURN n, r, m
        `;

        const result = await runQuery(cypher);

        const nodesMap = new Map();
        const links: any[] = [];

        // 2. Parse the Neo4j Results
        result.forEach((record: any) => {
            const n = record.get('n');
            const m = record.get('m');
            const r = record.get('r');

            // Helper function to safely extract node data
            const extractNode = (node: any) => {
                if (!node || !node.properties || !node.properties.id) return null;
                return {
                    id: String(node.properties.id),
                    label: node.labels?.[0] || 'Unknown',
                    ...node.properties
                };
            };

            const sourceNode = extractNode(n);
            const targetNode = extractNode(m);

            // Add unique nodes to the Map (prevents duplicates)
            if (sourceNode) nodesMap.set(sourceNode.id, sourceNode);
            if (targetNode) nodesMap.set(targetNode.id, targetNode);

            // Add the relationship link
            if (sourceNode && targetNode && r) {
                links.push({
                    source: sourceNode.id,
                    target: targetNode.id,
                    type: r.type
                });
            }
        });

        // 3. Send clean data back to GraphViewer
        return NextResponse.json({
            nodes: Array.from(nodesMap.values()),
            links: links
        });

    } catch (error) {
        console.error("Graph API Error:", error);
        return NextResponse.json({ error: "Failed to fetch graph data" }, { status: 500 });
    }
}