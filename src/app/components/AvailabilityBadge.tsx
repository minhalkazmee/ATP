interface Props {
  status: "Available Now" | "Inbound" | "Contact Us";
}

const styles = {
  "Available Now": { bg: "#EBF7F1", color: "#16a34a", dot: "#16a34a" },
  Inbound: { bg: "#FFF4DC", color: "#b45309", dot: "#FF6B00" },
  "Contact Us": { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF" },
};

/* Inject the keyframe once */
const styleId = "avail-pulse-ring";
if (typeof document !== "undefined" && !document.getElementById(styleId)) {
  const sheet = document.createElement("style");
  sheet.id = styleId;
  sheet.textContent = `
    @keyframes avail-pulse {
      0%   { transform: scale(1);   opacity: 0.45; }
      100% { transform: scale(2);   opacity: 0; }
    }
  `;
  document.head.appendChild(sheet);
}

export function AvailabilityBadge({ status }: Props) {
  const s = styles[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{ background: s.bg }}
    >
      <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: s.dot }}
        />
        {status === "Available Now" && (
          <span
            style={{
              position: "absolute",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: s.dot,
              animation: "avail-pulse 1.8s ease-out infinite",
            }}
          />
        )}
      </span>
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 600,
          fontSize: "0.7rem",
          color: s.color,
          whiteSpace: "nowrap",
        }}
      >
        {status}
      </span>
    </span>
  );
}