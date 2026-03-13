import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "What are my payment options?",
    a: "We accept credit card, wire transfer, ACH, check, Apple Pay, and Google Pay. Credit terms are available for qualifying businesses. A 2.5% cash discount is offered on ACH, wire, and check payments. All payments are processed securely via Stripe.",
  },
  {
    q: "How soon will my order ship?",
    a: 'Items marked "Available Now" typically ship in 3–5 business days for credit card and wire payments, 6–10 business days for ACH debit, and 7–14 business days for check payments. All orders are held for 72 hours to allow payment verification before shipment.',
  },
  {
    q: "Does Sunhub charge sales tax?",
    a: "Yes, sales tax is collected in states where Sunhub has nexus. If you have a valid resale certificate, you can submit it to be exempt from sales tax. Please allow 5–7 business days for processing.",
  },
  {
    q: "How do I place an order?",
    a: "Click the Request Quote button on any SKU, or email sales@sunhub.com with the SKUs and quantities you need. Minimum order quantities (MOQs) may apply depending on the product.",
  },
  {
    q: "Does Sunhub break pallets?",
    a: "No. All orders ship as full pallets only. Select clearance items may be available in smaller quantities — contact us for details.",
  },
  {
    q: "What if I need something not listed?",
    a: "Email sales@sunhub.com with your requirements. We can often source equipment through our supplier network or suggest suitable alternatives.",
  },
];

const font = "Inter, sans-serif";

export function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="faqs" className="border-t border-gray-200 bg-gray-50/50 py-16 scroll-mt-[64px]">
      <div className="mx-auto max-w-3xl px-5">
        <h2
          className="mb-8"
          style={{
            fontFamily: font,
            fontWeight: 800,
            fontSize: "1.35rem",
            color: "#0B2545",
            letterSpacing: "-0.01em",
          }}
        >
          FAQs
        </h2>

        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => {
            const isOpen = openIdx === i;
            return (
              <div
                key={i}
                className="overflow-hidden rounded-xl bg-white"
                style={{ border: "1px solid #E5E7EB" }}
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50"
                >
                  <span
                    style={{
                      fontFamily: font,
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      color: "#0B2545",
                    }}
                  >
                    {faq.q}
                  </span>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 transition-transform"
                    style={{
                      color: "#9CA3AF",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  />
                </button>
                <div
                  className="overflow-hidden transition-all"
                  style={{
                    maxHeight: isOpen ? "300px" : "0px",
                    opacity: isOpen ? 1 : 0,
                    transition: "max-height 0.3s ease, opacity 0.2s ease",
                  }}
                >
                  <div
                    className="px-5 pb-5"
                    style={{ borderTop: "1px solid #F3F4F6" }}
                  >
                    <p
                      className="pt-4"
                      style={{
                        fontFamily: font,
                        fontWeight: 400,
                        fontSize: "0.85rem",
                        lineHeight: 1.7,
                        color: "#6B7280",
                      }}
                    >
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
