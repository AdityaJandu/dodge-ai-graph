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

const DATA_DIR = path.join(process.cwd(), 'data');

// 🔥 CRITICAL DATA CLEANING FUNCTION
// Strips leading zeros to ensure foreign keys match primary keys perfectly
const cleanId = (id: any) => {
    if (!id) return "";
    return String(id).replace(/^0+/, '');
};

// Optimized Batch Runner using UNWIND
async function runBatchQuery(cypher: string, batch: any[]): Promise<void> {
    if (batch.length === 0) return;
    const session = driver.session();
    try {
        await session.run(cypher, { batch });
    } finally {
        await session.close();
    }
}

// Batch Processing Engine
async function processFileBatched(folderName: string, cypherQuery: string, mapLineToParams: (data: any) => any): Promise<void> {
    console.log(`\n⏳ Processing ${folderName}...`);
    const folderPath = path.join(DATA_DIR, folderName);

    if (!fs.existsSync(folderPath)) {
        console.log(`❌ Folder not found: ${folderPath}`);
        return;
    }

    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.jsonl'));
    let totalCount = 0;
    const BATCH_SIZE = 1000; // Processes 1,000 nodes at a time
    let currentBatch: any[] = [];

    for (const file of files) {
        const fileStream = fs.createReadStream(path.join(folderPath, file));
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        for await (const line of rl) {
            if (!line.trim()) continue;

            try {
                const data = JSON.parse(line);
                const params = mapLineToParams(data);
                // Only push if the primary ID exists
                if (params && params.id) currentBatch.push(params);

                if (currentBatch.length >= BATCH_SIZE) {
                    await runBatchQuery(cypherQuery, currentBatch);
                    totalCount += currentBatch.length;
                    process.stdout.write(`\rLoaded ${totalCount} records...`);
                    currentBatch = []; // Reset batch
                }
            } catch (err) {
                // Fail silently on bad JSON lines to keep the batch moving
            }
        }
    }

    // Flush remaining records
    if (currentBatch.length > 0) {
        await runBatchQuery(cypherQuery, currentBatch);
        totalCount += currentBatch.length;
    }

    console.log(`\n✅ Finished ${folderName}. Total: ${totalCount}`);
}

async function main() {
    console.log("🚀 Starting Flawless Enterprise Database Seed...");

    // STEP A: Set up Indexes for blazing fast lookups during MERGE
    const indexes = [
        "CREATE INDEX IF NOT EXISTS FOR (c:Customer) ON (c.id)",
        "CREATE INDEX IF NOT EXISTS FOR (p:Product) ON (p.id)",
        "CREATE INDEX IF NOT EXISTS FOR (so:SalesOrder) ON (so.id)",
        "CREATE INDEX IF NOT EXISTS FOR (d:Delivery) ON (d.id)",
        "CREATE INDEX IF NOT EXISTS FOR (b:BillingDocument) ON (b.id)",
        "CREATE INDEX IF NOT EXISTS FOR (j:JournalEntry) ON (j.id)",
        "CREATE INDEX IF NOT EXISTS FOR (pay:Payment) ON (pay.id)",
        "CREATE INDEX IF NOT EXISTS FOR (pl:Plant) ON (pl.id)"
    ];

    const session = driver.session();
    for (const query of indexes) {
        await session.run(query);
    }
    await session.close();
    console.log("✅ Indexes verified.");

    // STEP B: Master Data (Customers, Products, Plants)
    await processFileBatched('business_partners',
        `UNWIND $batch AS row MERGE (c:Customer {id: row.id}) SET c.name = row.name`,
        (data) => ({ id: cleanId(data.businessPartner), name: data.businessPartnerName })
    );

    await processFileBatched('products',
        `UNWIND $batch AS row MERGE (p:Product {id: row.id}) SET p.type = row.type, p.group = row.group`,
        (data) => ({ id: cleanId(data.product), type: data.productType, group: data.productGroup })
    );

    await processFileBatched('plants',
        `UNWIND $batch AS row MERGE (pl:Plant {id: row.id}) SET pl.name = row.name`,
        (data) => ({ id: cleanId(data.plant), name: data.plantName })
    );

    // STEP C: Transactional Data (The Graph Architecture)

    // 1. Sales Orders -> Linked to Customer
    await processFileBatched('sales_order_headers',
        `UNWIND $batch AS row 
         MERGE (so:SalesOrder {id: row.id}) 
         SET so.amount = toFloat(row.amount), so.currency = row.currency, so.status = row.status
         WITH so, row
         OPTIONAL MATCH (c:Customer {id: row.customerId})
         FOREACH (_ IN CASE WHEN c IS NOT NULL THEN [1] ELSE [] END | MERGE (c)-[:PLACED]->(so))`,
        (data) => ({
            id: cleanId(data.salesOrder),
            amount: data.totalNetAmount,
            currency: data.transactionCurrency,
            status: data.overallDeliveryStatus,
            customerId: cleanId(data.soldToParty)
        })
    );

    // 2. Sales Order Items -> Linked to Product
    await processFileBatched('sales_order_items',
        `UNWIND $batch AS row 
         MATCH (so:SalesOrder {id: row.id})
         MATCH (p:Product {id: row.productId})
         MERGE (so)-[:CONTAINS]->(p)`,
        (data) => ({
            id: cleanId(data.salesOrder),
            productId: cleanId(data.material)
        })
    );

    // 3. Outbound Deliveries (Headers)
    await processFileBatched('outbound_delivery_headers',
        `UNWIND $batch AS row 
         MERGE (d:Delivery {id: row.id})
         SET d.shippingPoint = row.shippingPoint`,
        (data) => ({
            id: cleanId(data.deliveryDocument),
            shippingPoint: data.shippingPoint
        })
    );

    // 4. Outbound Deliveries (Items) -> The Bridge to Sales Orders & Plants!
    await processFileBatched('outbound_delivery_items',
        `UNWIND $batch AS row 
         MATCH (d:Delivery {id: row.id})
         WITH d, row
         
         // Link backward to Sales Order
         OPTIONAL MATCH (so:SalesOrder {id: row.orderId})
         FOREACH (_ IN CASE WHEN so IS NOT NULL THEN [1] ELSE [] END | MERGE (so)-[:SHIPPED_VIA]->(d))
         
         // Link forward to Plant
         WITH d, row
         OPTIONAL MATCH (pl:Plant {id: row.plantId})
         FOREACH (_ IN CASE WHEN pl IS NOT NULL THEN [1] ELSE [] END | MERGE (d)-[:SHIPPED_FROM]->(pl))`,
        (data) => ({
            id: cleanId(data.deliveryDocument),
            orderId: cleanId(data.referenceSdDocument),
            plantId: cleanId(data.plant)
        })
    );

    // 5. Billing Documents -> Linked to Delivery/Order AND Product
    await processFileBatched('billing_document_items',
        `UNWIND $batch AS row 
         MERGE (b:BillingDocument {id: row.id})
         SET b.amount = toFloat(row.amount), b.material = row.material
         WITH b, row
         
         OPTIONAL MATCH (ref) WHERE (ref:Delivery OR ref:SalesOrder) AND ref.id = row.referenceId
         FOREACH (_ IN CASE WHEN ref IS NOT NULL THEN [1] ELSE [] END | MERGE (ref)-[:BILLED_IN]->(b))
         
         WITH b, row
         OPTIONAL MATCH (p:Product {id: row.material})
         FOREACH (_ IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (b)-[:BILLED_FOR]->(p))`,
        (data) => ({
            id: cleanId(data.billingDocument),
            amount: data.netAmount,
            material: cleanId(data.material),
            referenceId: cleanId(data.referenceSdDocument)
        })
    );

    // 6. Journal Entries -> Linked to Billing
    await processFileBatched('journal_entry_items_accounts_receivable',
        `UNWIND $batch AS row 
         MERGE (j:JournalEntry {id: row.id})
         SET j.amount = toFloat(row.amount), j.companyCode = row.companyCode
         WITH j, row
         
         OPTIONAL MATCH (b:BillingDocument {id: row.billingId})
         FOREACH (_ IN CASE WHEN b IS NOT NULL THEN [1] ELSE [] END | MERGE (b)-[:GENERATED_JOURNAL]->(j))`,
        (data) => ({
            id: cleanId(data.accountingDocument),
            amount: data.amountInTransactionCurrency,
            companyCode: data.companyCode,
            billingId: cleanId(data.referenceDocument)
        })
    );

    // 7. Payments -> Linked to Journal Entry
    await processFileBatched('payments_accounts_receivable',
        `UNWIND $batch AS row 
         MERGE (pay:Payment {id: row.id})
         SET pay.amount = toFloat(row.amount), pay.currency = row.currency
         WITH pay, row
         
         OPTIONAL MATCH (j:JournalEntry {id: row.journalId})
         FOREACH (_ IN CASE WHEN j IS NOT NULL THEN [1] ELSE [] END | MERGE (j)-[:CLEARED_BY]->(pay))`,
        (data) => ({
            id: cleanId(data.clearingAccountingDocument),
            amount: data.amountInTransactionCurrency,
            currency: data.transactionCurrency,
            journalId: cleanId(data.accountingDocument)
        })
    );

    console.log("🎉 Database seed complete!");
    await driver.close();
}

main().catch(console.error);