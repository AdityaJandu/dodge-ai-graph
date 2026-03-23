import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import neo4j from 'neo4j-driver';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// 1. Connect to Neo4j
const uri = process.env.NEO4J_URI as string;
const user = process.env.NEO4J_USERNAME as string;
const password = process.env.NEO4J_PASSWORD as string;
const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

// UPDATE THIS PATH to where your unzipped data folders live
const DATA_DIR = path.join(process.cwd(), 'data');

async function runQuery(cypher: string, params: any = {}) {
    const session = driver.session();
    try {
        await session.run(cypher, params);
    } finally {
        await session.close();
    }
}

async function processFile(folderName: string, cypherQuery: string, mapLineToParams: (data: any) => any) {
    console.log(`\n⏳ Processing ${folderName}...`);
    const folderPath = path.join(DATA_DIR, folderName);

    if (!fs.existsSync(folderPath)) {
        console.log(`❌ Folder not found: ${folderPath}`);
        return;
    }

    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.jsonl'));
    let count = 0;

    for (const file of files) {
        const fileStream = fs.createReadStream(path.join(folderPath, file));
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        for await (const line of rl) {
            if (!line.trim()) continue;
            const data = JSON.parse(line);
            const params = mapLineToParams(data);

            // Execute the Cypher query for this line
            await runQuery(cypherQuery, params);
            count++;

            if (count % 100 === 0) process.stdout.write(`\rLoaded ${count} records...`);
        }
    }
    console.log(`\n✅ Finished ${folderName}. Total: ${count}`);
}

async function main() {
    console.log("🚀 Starting Database Seed...");

    // STEP A: Set up Indexes for blazing fast lookups
    await runQuery(`CREATE INDEX IF NOT EXISTS FOR (o:SalesOrder) ON (o.id)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS FOR (b:BillingDocument) ON (b.id)`);
    await runQuery(`CREATE INDEX IF NOT EXISTS FOR (j:JournalEntry) ON (j.id)`);

    // STEP B: Load Sales Orders
    await processFile(
        'sales_order_headers',
        `MERGE (o:SalesOrder {id: $id}) SET o.amount = toFloat($amount), o.currency = $currency`,
        (data) => ({
            id: data.salesOrder,
            amount: data.totalNetAmount,
            currency: data.transactionCurrency
        })
    );

    // STEP C: Load Billing Documents and link to Sales Orders (via Delivery/Reference)
    await processFile(
        'billing_document_items',
        `
    MERGE (b:BillingDocument {id: $billingId})
    SET b.amount = toFloat($amount), b.material = $material
    
    // Link backward to the Sales Order or Delivery
    WITH b
    MATCH (o:SalesOrder {id: $referenceId})
    MERGE (o)-[:BILLED_IN]->(b)
    `,
        (data) => ({
            billingId: data.billingDocument,
            amount: data.netAmount,
            material: data.material,
            referenceId: data.referenceSdDocument // This acts as the foreign key
        })
    );

    // STEP D: Load Journal Entries and link to Billing
    await processFile(
        'journal_entry_items_accounts_receivable',
        `
    MERGE (j:JournalEntry {id: $journalId})
    SET j.amount = toFloat($amount), j.companyCode = $companyCode
    
    WITH j
    MATCH (b:BillingDocument {id: $billingId})
    MERGE (b)-[:GENERATED_JOURNAL]->(j)
    `,
        (data) => ({
            journalId: data.accountingDocument,
            amount: data.amountInTransactionCurrency,
            companyCode: data.companyCode,
            billingId: data.referenceDocument // Foreign key back to Billing
        })
    );

    console.log("🎉 Database seed complete!");
    await driver.close();
}

main().catch(console.error);