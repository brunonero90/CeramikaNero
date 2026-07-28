export type CustomerOrderStatus = {
  orderReference: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  fulfillmentMethod: string;
  subtotalGrossGrosz: number;
  shippingGrossGrosz: number;
  totalGrossGrosz: number;
  shippingQuoteRequired: boolean;
  selectedPaymentMethod?: string | null;
  paymentReconciling: boolean;
  canStartStripePayment: boolean;
  paymentProviderHint?: string | null;
  bookingReferences: string[];
  items: Array<{
    title: string;
    quantity: number;
    lineTotalGrossGrosz: number;
    itemType: string;
    fulfillmentMethod: string | null;
  }>;
  hasDeliveryAddress: boolean;
  city?: string | null;
  trackingReference?: string | null;
};
