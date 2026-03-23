import neo4j from 'neo4j-driver';

const uri = process.env.NEO4J_URI as string;
const user = process.env.NEO4J_USERNAME as string;
const password = process.env.NEO4J_PASSWORD as string;

if (!uri || !user || !password) {
    throw new Error('Missing Neo4j environment variables!');
}

// Initialize the driver
export const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

// Helper function to execute Cypher queries cleanly
export async function runQuery(cypher: string, params: Record<string, any> = {}) {
    const session = driver.session();
    try {
        const result = await session.run(cypher, params);
        return result.records;
    } finally {
        await session.close();
    }
}