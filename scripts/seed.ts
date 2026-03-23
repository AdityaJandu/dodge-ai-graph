import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import neo4j from 'neo4j-driver';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = Record<string, JsonValue>;
type Neo4jProperty = string | number | boolean;
type Neo4jProperties = Record<string, Neo4jProperty>;

// 1. Connect to Neo4j
const uri = process.env.NEO4J_URI as string;
const user = process.env.NEO4J_USERNAME as string;
const password = process.env.NEO4J_PASSWORD as string;
const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

const DATA_DIR = path.join(process.cwd(), 'data');

// 🔥 CRITICAL DATA CLEANING FUNCTION
// Strips leading zeros to ensure foreign keys match primary keys perfectly
const cleanId = (id: unknown): string => {
    if (!id) return "";
    return String(id).replace(/^0+/, '');
};

// Neo4j node properties must be primitive values (or arrays of primitives).
// We keep this script simple and serialize nested objects to JSON strings.
const toNeo4jProperties = (input: JsonRecord): Neo4jProperties => {
    const props: Neo4jProperties = {};

    for (const [key, value] of Object.entries(input)) {
        if (value === null || value === undefined) continue;

        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            props[key] = value;
            continue;
        }

        props[key] = JSON.stringify(value);
    }

    return props;
};

// Optimized Batch Runner using UNWIND
async function runBatchQuery<T extends object>(cypher: string, batch: T[]): Promise<void> {
    if (batch.length === 0) return;
    const session = driver.session();
    try {
        await session.run(cypher, { batch });
    } finally {
        await session.close();
    }
}

// Batch Processing Engine
async function processFileBatched<T extends { id: string }>(
    folderName: string,
    cypherQuery: string,
    mapLineToParams: (data: JsonRecord) => T | null
): Promise<void> {
    console.log(`\n⏳ Processing ${folderName}...`);
    const folderPath = path.join(DATA_DIR, folderName);

    if (!fs.existsSync(folderPath)) {
        console.log(`❌ Folder not found: ${folderPath}`);
        return;
    }

    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.jsonl'));
    let totalCount = 0;
    const BATCH_SIZE = 1000; // Processes 1,000 nodes at a time
    let currentBatch: T[] = [];

    for (const file of files) {
        const fileStream = fs.createReadStream(path.join(folderPath, file));
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        for await (const line of rl) {
            if (!line.trim()) continue;

            try {
                const data = JSON.parse(line) as JsonRecord;
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
        `UNWIND $batch AS row
         MERGE (c:Customer {id: row.id})
         SET c += row.props,
             c.name = coalesce(row.props.businessPartnerName, row.props.organizationBpName1, row.props.businessPartnerFullName, c.name)`,
        (data) => {
            const id = cleanId(data.businessPartner);
            if (!id) return null;
            return { id, props: toNeo4jProperties(data) };
        }
    );

    await processFileBatched('products',
        `UNWIND $batch AS row
         MERGE (p:Product {id: row.id})
         SET p += row.props,
             p.type = coalesce(row.props.productType, p.type),
             p.group = coalesce(row.props.productGroup, p.group)`,
        (data) => {
            const id = cleanId(data.product);
            if (!id) return null;
            return { id, props: toNeo4jProperties(data) };
        }
    );

    await processFileBatched('plants',
        `UNWIND $batch AS row
         MERGE (pl:Plant {id: row.id})
         SET pl += row.props,
             pl.name = coalesce(row.props.plantName, pl.name)`,
        (data) => {
            const id = cleanId(data.plant);
            if (!id) return null;
            return { id, props: toNeo4jProperties(data) };
        }
    );

    // STEP C: Transactional Data (The Graph Architecture)

    // 1. Sales Orders -> Linked to Customer
    await processFileBatched('sales_order_headers',
        `UNWIND $batch AS row 
         MERGE (so:SalesOrder {id: row.id}) 
         SET so += row.props,
             so.customerId = row.customerId,
             so.amount = toFloat(coalesce(row.amount, row.props.totalNetAmount)),
             so.currency = coalesce(row.currency, row.props.transactionCurrency),
             so.status = coalesce(row.status, row.props.overallDeliveryStatus)
         WITH so, row
         OPTIONAL MATCH (c:Customer {id: row.customerId})
         FOREACH (_ IN CASE WHEN c IS NOT NULL THEN [1] ELSE [] END | MERGE (c)-[:PLACED]->(so))`,
        (data) => {
            const id = cleanId(data.salesOrder);
            if (!id) return null;
            return {
                id,
                amount: data.totalNetAmount ? String(data.totalNetAmount) : "",
                currency: data.transactionCurrency ? String(data.transactionCurrency) : "",
                status: data.overallDeliveryStatus ? String(data.overallDeliveryStatus) : "",
                customerId: cleanId(data.soldToParty),
                props: toNeo4jProperties(data)
            };
        }
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
         SET d += row.props,
             d.shippingPoint = coalesce(row.shippingPoint, row.props.shippingPoint)`,
        (data) => {
            const id = cleanId(data.deliveryDocument);
            if (!id) return null;
            return {
                id,
                shippingPoint: data.shippingPoint ? String(data.shippingPoint) : "",
                props: toNeo4jProperties(data)
            };
        }
    );

    // 4. Outbound Deliveries (Items) -> The Bridge to Sales Orders & Plants!
    await processFileBatched('outbound_delivery_items',
        `UNWIND $batch AS row 
         MATCH (d:Delivery {id: row.id})
         SET d += row.props,
             d.orderId = row.orderId,
             d.plantId = row.plantId
         WITH d, row
         
         // Link backward to Sales Order
         OPTIONAL MATCH (so:SalesOrder {id: row.orderId})
         FOREACH (_ IN CASE WHEN so IS NOT NULL THEN [1] ELSE [] END | MERGE (so)-[:SHIPPED_VIA]->(d))
         
         // Link forward to Plant
         WITH d, row
         OPTIONAL MATCH (pl:Plant {id: row.plantId})
         FOREACH (_ IN CASE WHEN pl IS NOT NULL THEN [1] ELSE [] END | MERGE (d)-[:SHIPPED_FROM]->(pl))`,
        (data) => {
            const id = cleanId(data.deliveryDocument);
            if (!id) return null;
            return {
                id,
                orderId: cleanId(data.referenceSdDocument),
                plantId: cleanId(data.plant),
                props: toNeo4jProperties(data)
            };
        }
    );

    // 5. Billing Document Headers -> enrich Billing nodes with metadata
    await processFileBatched('billing_document_headers',
        `UNWIND $batch AS row 
         MERGE (b:BillingDocument {id: row.id})
         SET b += row.props,
             b.amount = toFloat(coalesce(row.props.totalNetAmount, b.amount)),
             b.currency = coalesce(row.props.transactionCurrency, b.currency)
         WITH b, row
         OPTIONAL MATCH (c:Customer {id: row.customerId})
         FOREACH (_ IN CASE WHEN c IS NOT NULL THEN [1] ELSE [] END | MERGE (c)-[:BILLED_TO]->(b))`,
        (data) => {
            const id = cleanId(data.billingDocument);
            if (!id) return null;
            return {
                id,
                customerId: cleanId(data.soldToParty),
                props: toNeo4jProperties(data)
            };
        }
    );

    // 6. Billing Documents -> Linked to Delivery/Order AND Product
    await processFileBatched('billing_document_items',
        `UNWIND $batch AS row 
         MERGE (b:BillingDocument {id: row.id})
         SET b += row.props,
             b.amount = toFloat(coalesce(row.amount, row.props.netAmount)),
             b.currency = coalesce(row.currency, row.props.transactionCurrency),
             b.material = coalesce(row.material, row.props.material),
             b.referenceId = row.referenceId
         WITH b, row
         
         OPTIONAL MATCH (ref) WHERE (ref:Delivery OR ref:SalesOrder) AND ref.id = row.referenceId
         FOREACH (_ IN CASE WHEN ref IS NOT NULL THEN [1] ELSE [] END | MERGE (ref)-[:BILLED_IN]->(b))
         
         WITH b, row
         OPTIONAL MATCH (p:Product {id: row.material})
         FOREACH (_ IN CASE WHEN p IS NOT NULL THEN [1] ELSE [] END | MERGE (b)-[:BILLED_FOR]->(p))`,
        (data) => {
            const id = cleanId(data.billingDocument);
            if (!id) return null;
            return {
                id,
                amount: data.netAmount ? String(data.netAmount) : "",
                currency: data.transactionCurrency ? String(data.transactionCurrency) : "",
                material: cleanId(data.material),
                referenceId: cleanId(data.referenceSdDocument),
                props: toNeo4jProperties(data)
            };
        }
    );

    // 7. Journal Entries -> Linked to Billing
    await processFileBatched('journal_entry_items_accounts_receivable',
        `UNWIND $batch AS row 
         MERGE (j:JournalEntry {id: row.id})
         SET j += row.props,
             j.amount = toFloat(coalesce(row.amount, row.props.amountInTransactionCurrency)),
             j.currency = coalesce(row.props.transactionCurrency, j.currency),
             j.companyCode = coalesce(row.companyCode, row.props.companyCode),
             j.billingId = row.billingId
         WITH j, row
         
         OPTIONAL MATCH (b:BillingDocument {id: row.billingId})
         FOREACH (_ IN CASE WHEN b IS NOT NULL THEN [1] ELSE [] END | MERGE (b)-[:GENERATED_JOURNAL]->(j))`,
        (data) => {
            const id = cleanId(data.accountingDocument);
            if (!id) return null;
            return {
                id,
                amount: data.amountInTransactionCurrency ? String(data.amountInTransactionCurrency) : "",
                companyCode: data.companyCode ? String(data.companyCode) : "",
                billingId: cleanId(data.referenceDocument),
                props: toNeo4jProperties(data)
            };
        }
    );

    // 8. Payments -> Linked to Journal Entry
    await processFileBatched('payments_accounts_receivable',
        `UNWIND $batch AS row 
         MERGE (pay:Payment {id: row.id})
         SET pay += row.props,
             pay.amount = toFloat(coalesce(row.amount, row.props.amountInTransactionCurrency)),
             pay.currency = coalesce(row.currency, row.props.transactionCurrency),
             pay.journalId = row.journalId
         WITH pay, row
         
         OPTIONAL MATCH (j:JournalEntry {id: row.journalId})
         FOREACH (_ IN CASE WHEN j IS NOT NULL THEN [1] ELSE [] END | MERGE (j)-[:CLEARED_BY]->(pay))`,
        (data) => {
            const id = cleanId(data.clearingAccountingDocument);
            if (!id) return null;
            return {
                id,
                amount: data.amountInTransactionCurrency ? String(data.amountInTransactionCurrency) : "",
                currency: data.transactionCurrency ? String(data.transactionCurrency) : "",
                journalId: cleanId(data.accountingDocument),
                props: toNeo4jProperties(data)
            };
        }
    );

    console.log("🎉 Database seed complete!");
    await driver.close();
}

main().catch(console.error);