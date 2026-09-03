import { QRCodeSVG } from 'qrcode.react';

interface InvoiceQRCodeProps {
  invoiceId: string;
  size?: number;
  className?: string;
  /** Base URL for the tracking page. Defaults to current origin. */
  baseUrl?: string;
}

/**
 * Generates a QR code that links to the public invoice tracking page.
 * The URL format is: {baseUrl}/invoice/{invoiceId}
 * 
 * Usage in invoice print/display:
 *   <InvoiceQRCode invoiceId="INV-001" size={120} />
 */
export default function InvoiceQRCode({ invoiceId, size = 120, className = '', baseUrl }: InvoiceQRCodeProps) {
  const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const trackingUrl = `${origin}/invoice/${encodeURIComponent(invoiceId)}`;

  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div className="bg-white p-2.5 rounded-xl shadow-[0_4px_12px_-4px_rgba(19,17,38,0.1)]">
        <QRCodeSVG
          value={trackingUrl}
          size={size}
          level="M"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#131126"
        />
      </div>
      <span className="text-[9px] font-semibold text-quill-soft text-center leading-tight">
        Scan to track<br />invoice status
      </span>
    </div>
  );
}

/**
 * Helper to get the public tracking URL for an invoice.
 * Use this when generating links or embedding in emails.
 */
export function getInvoiceTrackingUrl(invoiceId: string, baseUrl?: string): string {
  const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}/invoice/${encodeURIComponent(invoiceId)}`;
}
