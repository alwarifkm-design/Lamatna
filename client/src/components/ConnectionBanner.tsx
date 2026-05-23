import { useEffect, useState } from "react";
import {
  getServerUrl,
  getSocket,
  isServerConfigured,
  subscribeConnectionStatus,
  type ConnectionStatus,
} from "../socket";

export function ConnectionBanner() {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    if (isServerConfigured()) getSocket();
    return subscribeConnectionStatus(setStatus);
  }, []);

  if (!isServerConfigured()) {
    return (
      <div className="connection-banner error">
        لم يُضبط خادم اللعبة (VITE_SERVER_URL على Vercel). الأزرار لن تعمل حتى تضيف رابط Render.
      </div>
    );
  }

  if (status === "connected") return null;

  const msg =
    status === "connecting"
      ? "جاري الاتصال بالخادم..."
      : status === "error" || status === "disconnected"
        ? `غير متصل بالخادم (${getServerUrl()}) — تحقق من Render ثم حدّث الصفحة`
        : "";

  return <div className="connection-banner warn">{msg}</div>;
}
