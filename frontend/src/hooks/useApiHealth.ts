import { useEffect, useState } from "react";
import { fetchHealth } from "../api/health";

export type ApiStatus = "checking" | "online" | "offline";

export const useApiHealth = (): ApiStatus => {
  const [status, setStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    const controller = new AbortController();

    void fetchHealth(controller.signal)
      .then(() => setStatus("online"))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setStatus("offline");
        }
      });

    return () => controller.abort();
  }, []);

  return status;
};

