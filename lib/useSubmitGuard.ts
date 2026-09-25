"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Evita el doble envío: mientras una acción está en curso, un segundo click/Enter se ignora
 * (el ref lo bloquea de inmediato, antes de que React vuelva a renderizar) y el botón se
 * deshabilita con `submitting`. Siempre libera el bloqueo al terminar, con éxito o con error.
 */
export function useSubmitGuard() {
  const busy = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const guard = useCallback(
    <A extends unknown[]>(fn: (...args: A) => unknown) =>
      async (...args: A) => {
        const first = args[0] as { preventDefault?: () => void } | undefined;
        first?.preventDefault?.();
        if (busy.current) return;
        busy.current = true;
        setSubmitting(true);
        try {
          await fn(...args);
        } finally {
          busy.current = false;
          setSubmitting(false);
        }
      },
    []
  );

  return { submitting, guard };
}
