import { useEffect, useState } from "react";
import { markPreserveSession, clearPreserveSession, shouldPreserveSession } from "../lib/exitSave";

export function ExitSaveButton() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(shouldPreserveSession());
  }, []);

  return (
    <button
      type="button"
      className={`btn btn-outline btn-exit-save ${enabled ? "active" : ""}`}
      onClick={() => {
        markPreserveSession();
        setEnabled(true);
      }}
    >
      حفظ
    </button>
  );
}

