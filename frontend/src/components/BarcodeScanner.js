import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, Barcode } from "@phosphor-icons/react";

// Registered at module load time — before CRA overlay attaches its own listeners.
// Silences the benign "play() interrupted" DOMException from Html5Qrcode.
const _isPlayError = (msg) =>
  typeof msg === "string" &&
  (msg.includes("play()") || msg.includes("goo.gl/LdLk22") ||
    (msg.includes("interrupted") && msg.includes("media")));

const _origConsoleError = console.error;
console.error = (...args) => {
  if (_isPlayError(args.join(" "))) return;
  _origConsoleError(...args);
};

window.addEventListener("unhandledrejection", (e) => {
  if (_isPlayError(e?.reason?.message) || e?.reason?.name === "AbortError") {
    e.preventDefault();
  }
}, true);

window.addEventListener("error", (e) => {
  if (_isPlayError(e?.message)) e.stopImmediatePropagation();
}, true);

async function tapToFocus(videoEl, x, y) {
  try {
    const track = videoEl?.srcObject?.getVideoTracks?.()[0];
    if (!track) return;
    const caps = track.getCapabilities?.();
    // Use pointsOfInterest if supported (Android Chrome)
    if (caps?.pointsOfInterest) {
      const settings = track.getSettings();
      const px = x / videoEl.clientWidth;
      const py = y / videoEl.clientHeight;
      await track.applyConstraints({ advanced: [{ pointsOfInterest: [{ x: px, y: py }], focusMode: "manual" }] });
      // Revert to continuous after 2s
      setTimeout(() => {
        track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
      }, 2000);
    }
  } catch (e) { /* focus not supported — silently ignore */ }
}

export default function BarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [focusRipple, setFocusRipple] = useState(null);
  const mountedRef = useRef(true);
  const runningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;

    const scannerId = "barcode-reader-" + Date.now();
    const el = document.getElementById("barcode-reader-container");
    if (el) {
      el.innerHTML = "";
      const div = document.createElement("div");
      div.id = scannerId;
      div.style.width = "100%";
      el.appendChild(div);
    }

    const scanner = new Html5Qrcode(scannerId);
    scannerRef.current = scanner;

    const startScanner = async () => {
      try {
        await scanner.start(
          {
            facingMode: "environment",
            advanced: [{ focusMode: "continuous" }],
          },
          {
            fps: 10,
            qrbox: { width: 280, height: 150 },
            aspectRatio: 1.5,
            videoConstraints: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
              focusMode: "continuous",
              advanced: [{ focusMode: "continuous" }],
            },
          },
          (decodedText) => {
            if (!cancelled && mountedRef.current) {
              onScan(decodedText);
              stopAndClose();
            }
          },
          () => {}
        );
        if (cancelled) {
          try { await scanner.stop(); } catch (e) { /* ignore */ }
          return;
        }
        runningRef.current = true;
      } catch (err) {
        // Suppress "play() interrupted" — happens when modal closes before camera starts
        if (err?.name === "AbortError" || err?.message?.includes("play()")) return;
        if (!cancelled && mountedRef.current) {
          setError("Camera access denied or not available. Please allow camera permission.");
        }
      }
    };

    // Small delay ensures modal DOM is fully painted before scanner binds to video element
    const startTimer = setTimeout(startScanner, 150);

    // Touch-to-focus handler — attached after scanner starts
    const focusTimer = setTimeout(() => {
      const container = document.getElementById("barcode-reader-container");
      const video = container?.querySelector("video");
      if (!video) return;
      const onTap = (e) => {
        const rect = video.getBoundingClientRect();
        const touch = e.touches?.[0] ?? e;
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        setFocusRipple({ x: touch.clientX, y: touch.clientY, id: Date.now() });
        setTimeout(() => setFocusRipple(null), 700);
        tapToFocus(video, x, y);
      };
      video.addEventListener("touchstart", onTap, { passive: true });
      video.addEventListener("click", onTap);
      video._focusHandler = onTap;
    }, 500);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(focusTimer);
      cancelled = true;
      mountedRef.current = false;
      const stop = async () => {
        if (runningRef.current && scannerRef.current) {
          try { await scannerRef.current.stop(); } catch (e) { /* ignore */ }
          runningRef.current = false;
        }
        // Kill any lingering camera tracks in case stop() wasn't reached
        try {
          document.querySelectorAll("video").forEach(v => {
            if (v._focusHandler) {
              v.removeEventListener("touchstart", v._focusHandler);
              v.removeEventListener("click", v._focusHandler);
            }
            v.srcObject?.getTracks?.().forEach(t => t.stop());
          });
        } catch (e) { /* ignore */ }
      };
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAndClose = () => {
    if (runningRef.current && scannerRef.current) {
      try {
        scannerRef.current.stop().then(() => { runningRef.current = false; onClose(); }).catch(() => { onClose(); });
      } catch (e) { onClose(); }
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" data-testid="barcode-scanner-modal">
      <div className="bg-[var(--surface)] rounded-sm max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Barcode size={20} weight="duotone" className="text-[var(--brand)]" />
            <h3 className="font-heading text-base font-medium">Scan Barcode</h3>
          </div>
          <button data-testid="close-scanner-btn" onClick={stopAndClose} className="p-1.5 hover:bg-[var(--bg)] rounded-sm">
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          {error ? (
            <div className="text-center py-8">
              <Camera size={40} weight="thin" className="mx-auto text-[var(--text-secondary)] mb-3" />
              <p className="text-sm text-[var(--error)]">{error}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-2">Use HTTPS and grant camera permission</p>
            </div>
          ) : (
            <>
              <div id="barcode-reader-container" className="w-full rounded-sm overflow-hidden" style={{ minHeight: 250 }} />
              <p className="text-xs text-[var(--text-secondary)] text-center mt-3">Point camera at barcode · Tap to focus</p>
              {focusRipple && (
                <div
                  key={focusRipple.id}
                  className="pointer-events-none fixed z-[60] w-12 h-12 rounded-full border-2 border-white/80 animate-ping"
                  style={{ left: focusRipple.x - 24, top: focusRipple.y - 24 }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
