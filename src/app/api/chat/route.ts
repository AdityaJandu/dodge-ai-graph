import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { runQuery } from '@/lib/neo4j';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const SYSTEM_PROMPT = `
You are an AI agent analyzing an "Order to Cash" graph database.

SCHEMA:
- (SalesOrder {id, amount, currency})
- (BillingDocument {id, amount, material})
- (JournalEntry {id, amount, companyCode})

RULES:
1. ALWAYS return full nodes
2. Use toString(node.id)
3. Use undirected relationships
4. LIMIT 20

OUTPUT:
{
  "guardrail": false,
  "cypher": "MATCH (s:SalesOrder) RETURN s LIMIT 10"
}
`;

// Helper function to call Gemini with a prompt
async function callGemini(prompt: string): Promise<string> {
    const result = await model.generateContent(prompt);
    return result.response.text();
}

// API Route Handler
// This handles POST (chat query)
export async function POST(req: Request): Promise<Response> {
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

        const dbResult = await runQuery(cypherQuery);

        // Normalize data
        const cleanData = dbResult.map((record: any) => {
            const obj: any = {};

            record.keys.forEach((key: string) => {
                const val = record.get(key);

                if (val?.properties) {
                    const props = val.properties;

                    obj[key] = {
                        id: String(
                            props.id ||
                            props.billingDocument ||
                            props.accountingDocument
                        ),
                        label: val.labels[0],
                        ...props
                    };
                }
            });

            return obj;
        });

        // Extract highlight IDs
        const highlightIds: string[] = [];

        cleanData.forEach((row: any) => {
            Object.values(row).forEach((node: any) => {
                if (node?.id) {
                    highlightIds.push(String(node.id));
                }
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