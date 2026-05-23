import { useState } from "react";
import { getSocket, waitForConnection } from "../socket";

interface AdminPinModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AdminPinModal({ onClose, onSuccess }: AdminPinModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      await waitForConnection();
      getSocket().emit("admin:authenticate", pin, (ok: boolean) => {
        if (ok) {
          onSuccess();
        } else {
          setError("رمز الإدارة غير صحيح");
        }
        setBusy(false);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل الاتصال");
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="display-title" style={{ marginBottom: "1rem", textAlign: "center" }}>
          دخول الإدارة
        </h2>
        <input
          className="input-field"
          type="password"
          inputMode="numeric"
          placeholder="أدخل رمز الإدارة"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && !busy && submit()}
          autoFocus
        />
        {error && (
          <p style={{ color: "var(--terracotta)", marginTop: "0.5rem", fontSize: "0.9rem" }}>
            {error}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={submit}
            disabled={busy}
          >
            {busy ? "جاري الاتصال..." : "دخول"}
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
