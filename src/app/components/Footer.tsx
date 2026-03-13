const font = "Inter, sans-serif";

export function Footer() {
  return (
    <footer id="footer" style={{ background: "#0B2545", height: "80px" }}>
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-5">
        {/* Logo */}
        <a href="#" className="flex items-center">
          <img
            src="https://www.sunhub.com/assets/images/revamp/logo.svg"
            alt="Sunhub"
            style={{ height: "22px", filter: "brightness(0) invert(1)" }}
          />
        </a>


        {/* Right */}
        <div className="flex flex-col items-end gap-1">
          <a
            href="mailto:sales@sunhub.com"
            style={{
              fontFamily: font,
              fontWeight: 500,
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.6)",
            }}
            className="hover:text-white"
          >
            sales@sunhub.com
          </a>
          <span
            style={{
              fontFamily: font,
              fontWeight: 400,
              fontSize: "0.72rem",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            &copy; 2026 Sunhub, Inc. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
