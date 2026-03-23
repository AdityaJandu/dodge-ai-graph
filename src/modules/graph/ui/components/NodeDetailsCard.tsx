"use client";

import { X } from 'lucide-react';

type Props = {
    node: any;
    position?: { x: number; y: number };
    pinned?: boolean;
    onClose?: () => void; // 🔥 CRITICAL: Allows dismissing the pinned card
};

export default function NodeDetailsCard({ node, position, pinned = false, onClose }: Props) {
    if (!node) return null;

    const label = node.label || "Unknown Node";

    // 🎯 SAFE FORMATTERS
    const formatDate = (val: string) => {
        if (!val) return "-";
        // Handle SAP date strings if they come in weird formats
        const d = new Date(val);
        return isNaN(d.getTime()) ? val : d.toLocaleDateString();
    };

    const money = (val: any, currency?: string) => {
        if (!val) return "-";
        // Format numbers nicely with commas
        const num = Number(val);
        const formattedNum = isNaN(num) ? val : num.toLocaleString();
        return `${currency || ""} ${formattedNum}`.trim();
    };

    // 🎯 NEW: MASTER DATA CARDS
    const CustomerCard = () => (
        <>
            <Row label="Customer ID" value={node.id || node.BusinessPartner} />
            <Row label="Name" value={node.name || node.BusinessPartnerName} />
            <Row label="Country" value={node.country || node.Country} />
        </>
    );

    const ProductCard = () => (
        <>
            <Row label="Product ID" value={node.id || node.Product} />
            <Row label="Type" value={node.type || node.ProductType} />
            <Row label="Category" value={node.group || node.ProductGroup} />
        </>
    );

    // 🔥 NEW: Plant Card
    const PlantCard = () => (
        <>
            <Row label="Plant ID" value={node.id || node.Plant} />
            <Row label="Name" value={node.name || node.PlantName} />
        </>
    );

    // 🎯 UPDATED: TRANSACTIONAL CARDS
    const SalesOrderCard = () => (
        <>
            <Row label="Order ID" value={node.id || node.SalesOrder} />
            <Row label="Amount" value={money(node.amount || node.TotalNetAmount, node.currency || node.TransactionCurrency)} />
            <Row label="Customer Ref" value={node.customerId || node.SoldToParty} />
            <Row label="Status" value={node.status || node.OverallDeliveryStatus || node.overallDeliveryStatus} />
            <Row label="Created On" value={formatDate(node.date || node.CreationDate || node.creationDate)} />
        </>
    );

    const DeliveryCard = () => (
        <>
            <Row label="Delivery ID" value={node.id || node.DeliveryDocument} />
            <Row label="Order Ref" value={node.orderId || node.ReferenceSDDocument} />
            <Row label="Shipping Point" value={node.shippingPoint || node.ShippingPoint} />
            <Row label="Planned Date" value={formatDate(node.plannedDate || node.PlannedGoodsIssueDate)} />
        </>
    );

    const BillingCard = () => (
        <>
            <Row label="Billing ID" value={node.id || node.BillingDocument} />
            <Row label="Amount" value={money(node.amount || node.NetAmount, node.currency || node.TransactionCurrency)} />
            <Row label="Reference Doc" value={node.referenceId || node.ReferenceSDDocument} />
            <Row label="Material" value={node.material || node.Material} />
        </>
    );

    const JournalCard = () => (
        <>
            <Row label="Document No" value={node.id || node.AccountingDocument} />
            <Row label="Company Code" value={node.companyCode || node.CompanyCode} />
            <Row label="Amount" value={money(node.amount || node.AmountInTransactionCurrency, node.currency || node.CompanyCodeCurrency)} />
            <Row label="Billing Ref" value={node.billingId || node.ReferenceDocument} />
            <Row label="Posting Date" value={formatDate(node.date || node.PostingDate || node.postingDate)} />
        </>
    );

    const PaymentCard = () => (
        <>
            <Row label="Payment ID" value={node.id || node.AccountingDocument} />
            <Row label="Amount" value={money(node.amount || node.AmountInTransactionCurrency, node.currency || node.CompanyCodeCurrency)} />
            <Row label="Clearing Ref" value={node.journalId || node.ClearingAccountingDocument} />
        </>
    );

    // 🎯 SMART FALLBACK CARD (Limits rows so it doesn't break the screen)
    const DefaultCard = () => (
        <>
            <Row label="Node ID" value={node.id} />
            {Object.entries(node)
                .filter(([key]) => !['x', 'y', 'vx', 'vy', 'index', 'color', 'label', 'id'].includes(key))
                .filter(([, value]) => typeof value !== 'object') // Ignore nested DB objects
                .slice(0, 6) // Max 6 rows
                .map(([key, value]) => (
                    <Row key={key} label={key} value={String(value)} />
                ))
            }
        </>
    );

    // Dynamic Card Routing
    const renderCardContent = () => {
        switch (label) {
            case "Customer": return <CustomerCard />;
            case "Product": return <ProductCard />;
            case "Plant": return <PlantCard />;
            case "SalesOrder": return <SalesOrderCard />;
            case "Delivery": return <DeliveryCard />;
            case "BillingDocument": return <BillingCard />;
            case "JournalEntry": return <JournalCard />;
            case "Payment": return <PaymentCard />;
            default: return <DefaultCard />;
        }
    };

    return (
        <div
            className={`z-50 bg-white/95 backdrop-blur-sm shadow-2xl border border-gray-200 rounded-2xl w-80 text-xs transition-opacity duration-200
            ${pinned ? "absolute right-4 top-4 opacity-100" : "absolute pointer-events-none opacity-95"}`}
            style={pinned ? {} : { left: (position?.x || 0) + 15, top: (position?.y || 0) + 15 }}
        >
            {/* Header Area with Dynamic Color and Close Button */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-linear-to-r from-[#fffefc] to-white rounded-t-2xl">
                <div className="flex items-center gap-2">
                    {/* Color dot matches the graph node color */}
                    <div
                        className="w-2.5 h-2.5 rounded-full shadow-sm ring-2 ring-white"
                        style={{ backgroundColor: node.color || '#94a3b8' }}
                    />
                    <h3 className="font-semibold text-[#37352f] text-sm tracking-tight">
                        {label.replace(/([A-Z])/g, ' $1').trim()} {/* Formats "SalesOrder" to "Sales Order" */}
                    </h3>
                    <span className="text-[10px] uppercase tracking-wide text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">
                        {label}
                    </span>
                </div>
                {pinned && onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors pointer-events-auto"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="p-4 space-y-2.5">
                {renderCardContent()}
            </div>
        </div>
    );
}

// 🔹 UI helpers
function Row({ label, value }: { label: string; value: any }) {
    if (!value || value === "undefined" || value === "null") return null; // Don't render empty rows

    return (
        <div className="grid grid-cols-[96px_1fr] items-start gap-3 border border-gray-100 rounded-lg px-2.5 py-2 bg-gray-50/40">
            <span className="text-[11px] text-gray-500 leading-5">{label}</span>
            <span className="font-mono text-[11px] text-gray-800 text-right break-all font-medium leading-5">
                {value}
            </span>
        </div>
    );
}