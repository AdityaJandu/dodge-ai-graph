"use client";

type Props = {
    node: any;
    position?: { x: number; y: number };
    pinned?: boolean;
};

export default function NodeDetailsCard({ node, position, pinned = false }: Props) {
    if (!node) return null;

    const label = node.label;

    // 🎯 FORMATTERS
    const formatDate = (val: string) =>
        val ? new Date(val).toLocaleDateString() : "-";

    const money = (val: any, currency?: string) =>
        val ? `${currency || ""} ${val}` : "-";

    // 🎯 SALES ORDER CARD
    const SalesOrderCard = () => (
        <>
            <Header title="Sales Order" />

            <Row label="Order ID" value={node.salesOrder} />
            <Row label="Customer" value={node.soldToParty} />
            <Row label="Amount" value={money(node.totalNetAmount, node.transactionCurrency)} />
            <Row label="Status" value={node.overallDeliveryStatus} />
            <Row label="Created By" value={node.createdByUser} />
            <Row label="Created On" value={formatDate(node.creationDate)} />
            <Row label="Delivery Date" value={formatDate(node.requestedDeliveryDate)} />
            <Row label="Incoterms" value={node.incotermsClassification} />
        </>
    );

    // 🎯 BILLING CARD
    const BillingCard = () => (
        <>
            <Header title="Billing Document" />

            <Row label="Billing ID" value={node.billingDocument} />
            <Row label="Material" value={node.material} />
            <Row label="Quantity" value={`${node.billingQuantity} ${node.billingQuantityUnit}`} />
            <Row label="Amount" value={money(node.netAmount, node.transactionCurrency)} />
            <Row label="Reference Order" value={node.referenceSdDocument} />
        </>
    );

    // 🎯 JOURNAL CARD
    const JournalCard = () => (
        <>
            <Header title="Journal Entry" />

            <Row label="Document No" value={node.accountingDocument} />
            <Row label="Company" value={node.companyCode} />
            <Row label="GL Account" value={node.glAccount} />
            <Row label="Amount" value={money(node.amountInTransactionCurrency, node.transactionCurrency)} />
            <Row label="Profit Center" value={node.profitCenter} />
            <Row label="Customer" value={node.customer} />
            <Row label="Posting Date" value={formatDate(node.postingDate)} />
            <Row label="Document Type" value={node.accountingDocumentType} />
        </>
    );

    // 🎯 FALLBACK CARD
    const DefaultCard = () => (
        <>
            <Header title={label} />

            {Object.entries(node).map(([key, value]) => {
                if (['x', 'y', 'vx', 'vy', 'index', 'color', 'label'].includes(key)) return null;

                return <Row key={key} label={key} value={String(value)} />;
            })}
        </>
    );

    return (
        <div
            className={`z-50 bg-white shadow-2xl border border-gray-100 rounded-xl p-4 w-72 text-xs
            ${pinned ? "absolute right-4 top-4" : "absolute"}`}
            style={
                pinned
                    ? {}
                    : {
                        left: position!.x + 12,
                        top: position!.y + 12
                    }
            }
        >
            {label === "SalesOrder" && <SalesOrderCard />}
            {label === "BillingDocument" && <BillingCard />}
            {label === "JournalEntry" && <JournalCard />}
            {!["SalesOrder", "BillingDocument", "JournalEntry"].includes(label) && <DefaultCard />}
        </div>
    );
}

// 🔹 UI helpers

function Header({ title }: { title: string }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <h3 className="font-bold text-[#37352f] text-sm">{title}</h3>
        </div>
    );
}

function Row({ label, value }: { label: string; value: any }) {
    return (
        <div className="flex justify-between gap-2 border-b border-gray-50 pb-1">
            <span className="text-gray-400">{label}:</span>
            <span className="font-mono text-gray-700 text-right break-all">
                {value || "-"}
            </span>
        </div>
    );
}