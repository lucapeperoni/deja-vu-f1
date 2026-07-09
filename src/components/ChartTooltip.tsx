"use client";

// Tooltip condiviso da tutte le viste D3 della pagina gara e della home
// (task 5.2, passata di qualità: "tooltip coerenti — stesso componente
// ovunque").
//
// Bug corretto (task 5.3): il tooltip riceveva coordinate calcolate con
// d3.pointer(event, svgRef.current), cioè nello spazio del viewBox
// dell'SVG, e le usava come offset CSS assoluti dentro un contenitore
// "position: relative". Le due cose combaciano SOLO se l'SVG è renderizzato
// esattamente alla sua dimensione intrinseca (width/height in px uguali al
// viewBox): con width="100%" su un contenitore più stretto del viewBox, o
// semplicemente dentro un antenato con overflow-x-auto (che per le regole
// CSS forza anche l'asse Y a "auto", cioè clippa), il tooltip finiva
// disallineato (più lontano dal cursore quanto più in basso/a destra si
// stava) o tagliato a metà.
//
// La correzione: il tooltip è un portal su document.body, posizionato con
// "position: fixed" usando le coordinate VIEWPORT del puntatore
// (event.clientX/clientY, non d3.pointer). Così non dipende né dalla scala
// dell'SVG né dall'overflow di nessun antenato — è sempre visibile e sempre
// nel punto giusto, qualunque vista lo usi.
//
// Effetto collaterale di "position: fixed" (secondo bug, stesso task):
// essendo ancorato al viewport e non al contenitore del grafico, se
// l'utente scorre la pagina SENZA muovere il mouse (rotellina, trackpad)
// nessun evento pointermove/pointerleave scatta sull'elemento SVG sotto —
// il tooltip restava quindi "appeso" alla stessa posizione dello schermo,
// seguendo la pagina sezione dopo sezione invece di sparire. Corretto con
// un listener di scroll (capture, perché "scroll" non fa bubbling) che
// chiude il tooltip non appena la pagina si muove sotto di lui.

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  // Coordinate del puntatore in spazio VIEWPORT (event.clientX/clientY),
  // non coordinate SVG/locali al grafico.
  x: number;
  y: number;
  children: ReactNode;
  maxWidthPx?: number;
  // Chiamato quando la pagina scorre (o la finestra cambia dimensione)
  // mentre il tooltip è aperto: il chiamante deve azzerare il proprio
  // stato (setTooltip(null)), altrimenti il tooltip resta visibile senza
  // più corrispondere a nulla sotto il cursore.
  onDismiss: () => void;
}

// Margine di sicurezza dal bordo della finestra: sotto questa soglia il
// tooltip viene spinto indietro invece di uscire dal viewport.
const VIEWPORT_MARGIN = 8;

export default function ChartTooltip({ x, y, children, maxWidthPx, onDismiss }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleScroll = () => onDismiss();
    // capture: true — "scroll" non fa bubbling, quindi per intercettare lo
    // scroll di QUALSIASI contenitore scrollabile nella pagina (non solo
    // window) serve ascoltare in fase di cattura sul documento.
    document.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    return () => {
      document.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("resize", handleScroll);
    };
  }, [onDismiss]);

  // Il tooltip segue il cursore in basso-a-destra (x+12, y-10). Essendo
  // "position: fixed" in un portal su document.body, x/y sono già
  // coordinate viewport: si misura la posizione effettiva dopo il render e
  // si corregge prima del paint, così resta sempre interamente visibile.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.left = `${x + 12}px`;
    el.style.top = `${y - 10}px`;

    const rect = el.getBoundingClientRect();
    const overflowRight = rect.right - (window.innerWidth - VIEWPORT_MARGIN);
    const overflowBottom = rect.bottom - (window.innerHeight - VIEWPORT_MARGIN);
    const overflowLeft = VIEWPORT_MARGIN - rect.left;
    const overflowTop = VIEWPORT_MARGIN - rect.top;

    if (overflowRight > 0) el.style.left = `${x + 12 - overflowRight}px`;
    if (overflowBottom > 0) el.style.top = `${y - 10 - overflowBottom}px`;
    if (overflowLeft > 0) el.style.left = `${x + 12 + overflowLeft}px`;
    if (overflowTop > 0) el.style.top = `${y - 10 + overflowTop}px`;
  }, [x, y, children]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      className="pointer-events-none fixed z-50 rounded-md border border-white/20 bg-black/90 px-3 py-2 text-xs text-white shadow-xl"
      style={{ left: x + 12, top: y - 10, maxWidth: maxWidthPx }}
    >
      {children}
    </div>,
    document.body
  );
}
