import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, Barcode } from "@phosphor-icons/react";

export default function BarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const runningRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const scannerId = "barcode-reader-" + Date.now();
    const el = document.getElementById("barcode-reader-container");
    if (el) {
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
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 150 }, aspectRatio: 1.5 },
          (decodedText) => {
            if (mountedRef.current) {
              onScan(decodedText);
              stopAndClose();
            }
          },
          () => {}
        );
        runningRef.current = true;
      } catch (err) {
        if (mountedRef.current) {
          setError("Camera access denied or not available. Please allow camera permission.");
        }
      }
    };

    startScanner();

    return () => {
      mountedRef.current = false;
      if (runningRef.current && scannerRef.current) {
        try {
          scannerRef.current.stop().then(() => { runningRef.current = false; }).catch(() => {});
        } catch (e) { /* ignore */ }
      }
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
      <div className="bg-white rounded-sm max-w-md w-full overflow-hidden">
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
              <p className="text-xs text-[var(--text-secondary)] text-center mt-3">Point your camera at a barcode</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
