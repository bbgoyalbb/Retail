import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, Barcode } from "@phosphor-icons/react";

export default function BarcodeScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const scanner = new Html5Qrcode("barcode-reader");
    scannerRef.current = scanner;
    let isActive = true;

    const startScanner = async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 280, height: 150 },
            aspectRatio: 1.5,
          },
          (decodedText) => {
            if (isActive) {
              onScan(decodedText);
              scanner.stop().catch(() => {});
              onClose();
            }
          },
          () => {}
        );
        if (isActive) setStarted(true);
      } catch (err) {
        if (isActive) setError("Camera access denied or not available. Please allow camera permission and try again.");
      }
    };

    startScanner();

    return () => {
      isActive = false;
      scanner.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" data-testid="barcode-scanner-modal">
      <div className="bg-white rounded-sm max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Barcode size={20} weight="duotone" className="text-[var(--brand)]" />
            <h3 className="font-heading text-base font-medium">Scan Barcode</h3>
          </div>
          <button
            data-testid="close-scanner-btn"
            onClick={() => {
              if (scannerRef.current) scannerRef.current.stop().catch(() => {});
              onClose();
            }}
            className="p-1.5 hover:bg-[var(--bg)] rounded-sm transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scanner */}
        <div className="p-4">
          {error ? (
            <div className="text-center py-8">
              <Camera size={40} weight="thin" className="mx-auto text-[var(--text-secondary)] mb-3" />
              <p className="text-sm text-[var(--error)]">{error}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-2">
                Make sure you're using HTTPS and have granted camera permission
              </p>
            </div>
          ) : (
            <>
              <div id="barcode-reader" className="w-full rounded-sm overflow-hidden" style={{ minHeight: 250 }} />
              <p className="text-xs text-[var(--text-secondary)] text-center mt-3">
                Point your camera at a barcode. It will scan automatically.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
