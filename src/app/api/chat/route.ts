import { NextResponse, NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { runQuery } from '@/lib/neo4j';

type Neo4jNodeLike = {
    properties: Record<string, unknown>;
    labels: string[];
};

type NormalizedNode = {
    id: string;
    label: string;
    [key: string]: unknown;
};

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const SYSTEM_PROMPT = `
You are an AI agent analyzing an "Order to Cash" graph database.

SCHEMA:
- (Customer {id})
- (SalesOrder {id, amount, currency})
- (BillingDocument {id, amount, material})
- (JournalEntry {id, amount, companyCode})

RULES:
1. ALWAYS return full nodes
2. Use toString(node.id)
3. Use undirected relationships when traversing between entities
4. When the user asks for a Customer (or "customer id"), query :Customer by id:
   MATCH (c:Customer) WHERE toString(c.id) = '<id>' RETURN c LIMIT 10
5. LIMIT 20

OUTPUT:
{
  "guardrail": false,
  "cypher": "MATCH (c:Customer) RETURN c LIMIT 10"
}
`;

// Helper function to call Gemini with a prompt
async function callGemini(prompt: string): Promise<string> {
    const result = await model.generateContent(prompt);
    return result.response.text();
}

// API Route Handler
// This handles POST (chat query)
export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const body = await req.json();
        const userMessage = body.message;

        const prompt = `${SYSTEM_PROMPT}\n\nUser Question: ${userMessage}`;
        const rawText = await callGemini(prompt);

        const parsed = JSON.parse(
            rawText.replace(/```json/g, '').replace(/```/g, '').trim()
        );

        if (parsed.guardrail) {
            return NextResponse.json({ text: parsed.message, type: 'guardrail' });
        }

        const cypherQuery = parsed.cypher;

        const dbResult = await runQuery(cypherQuery) as unknown as Array<{
            keys: string[];
            get: (key: string) => unknown;
        }>;

        const isNeo4jNode = (val: unknown): val is Neo4jNodeLike => {
            if (!val || typeof val !== 'object') return false;
            const maybe = val as { properties?: unknown; labels?: unknown };
            if (!maybe.properties || typeof maybe.properties !== 'object') return false;
            if (!Array.isArray(maybe.labels)) return false;
            if (!maybe.labels.every(l => typeof l === 'string')) return false;
            return true;
        };

        // Normalize data
        const cleanData = dbResult.map((record) => {
            const obj: Record<string, NormalizedNode> = {};

            record.keys.forEach((key: string) => {
                const val = record.get(key);
                if (!isNeo4jNode(val)) return;

                const props = val.properties;
                const nodeIdCandidate: unknown =
                    props.id ?? props.billingDocument ?? props.accountingDocument;

                const nodeIdOk =
                    typeof nodeIdCandidate === 'string' || typeof nodeIdCandidate === 'number';
                if (!nodeIdOk) return;

                obj[key] = { id: String(nodeIdCandidate), label: val.labels[0], ...props };
            });

            return obj;
        });

        // Extract highlight IDs
        const highlightIds: string[] = [];

        cleanData.forEach((row) => {
            Object.values(row).forEach((node) => {
                highlightIds.push(String(node.id));
            });
        });

        return NextResponse.json({
            text: cleanData.length ? `Found ${cleanData.length} result(s).` : "No results found.",
            cypherUsed: cypherQuery,
            data: cleanData,
            highlightIds
        });

    } catch (error) {
        console.error("Chat API Error:", error);
        return NextResponse.json({ error: "Failed to process query" }, { status: 500 });
    }
}