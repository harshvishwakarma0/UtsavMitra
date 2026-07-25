import { useEffect, useState } from "react";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 rounded-xl border border-primary/30 bg-surface p-3 shadow-lg animate-fade-in">
      <div className="flex items-center gap-3">
        <span className="text-2xl">📱</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-text">Install Utsav Mitra</p>
          <p className="text-xs text-text-dim">Add to home screen for quick access</p>
        </div>
        <button
          onClick={async () => {
            deferredPrompt?.prompt();
            const { outcome } = await deferredPrompt?.userChoice;
            if (outcome === "accepted") setShow(false);
          }}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-black"
        >
          Install
        </button>
        <button onClick={() => setShow(false)} className="text-xs text-text-dim hover:text-text">
          ✕
        </button>
      </div>
    </div>
  );
}
