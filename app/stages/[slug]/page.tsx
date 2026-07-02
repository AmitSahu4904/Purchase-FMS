"use client";

import { useParams } from "next/navigation";
import CreateIndent from "@/components/stages/create-indent";
import IndentApproval from "@/components/stages/indent-approval";
import Quotation from "@/components/stages/quotation";
import ApprovedVendor from "@/components/stages/approved-vendor";
import POEntry from "@/components/stages/po-entry";
import Payment from "@/components/stages/payment";
import Lifting from "@/components/stages/lifting";
import TransporterFollowUp from "@/components/stages/transporter-follow-up";
import MaterialReceived from "@/components/stages/material-received";
import BillingStage from "@/components/stages/billing";
import PurchaseReturn from "@/components/stages/purchase-return";
import VendorPayment from "@/components/stages/vendor-payment";
import FreightPayments from "@/components/stages/freight-payments";
import OrderCancelPage from "@/components/stages/order-cancel";

const stageComponents: Record<string, React.ComponentType> = {
    "create-indent": CreateIndent,
    "indent-approval": IndentApproval,
    "quotation": Quotation,
    "purchase-enquiry": Quotation,
    "approved-vendor": ApprovedVendor,
    "po-entry": POEntry,
    "payment": Payment,
    "follow-up-vendor": Lifting,
    "transporter-follow-up": TransporterFollowUp,
    "material-received": MaterialReceived,
    "receipt-in-tally": BillingStage,
    "purchase-return": PurchaseReturn,
    "vendor-payment": VendorPayment,
    "freight-payments": FreightPayments,
    "order-cancel": OrderCancelPage,
};

export default function StagePage() {
    const params = useParams();
    const slug = params.slug as string;

    const StageComponent = stageComponents[slug];

    if (!StageComponent) {
        return <div className="p-6">Stage not found {slug}</div>;
    }

    return <StageComponent />;
}
