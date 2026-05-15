import type { SeriesMarkerBar, UTCTimestamp } from "lightweight-charts";
import type { BackendMarker } from "@/types/portfolio-chart";

const BUY_COLOR = "#16c784";
const SELL_COLOR = "#ea3943";

export function mapMarkersToLightweight(
  markers: readonly BackendMarker[],
): SeriesMarkerBar<UTCTimestamp>[] {
  return markers.map((marker): SeriesMarkerBar<UTCTimestamp> => {
    const isBuy = marker.type === "BUY";
    return {
      time: marker.time as UTCTimestamp,
      position: isBuy ? "belowBar" : "aboveBar",
      color: isBuy ? BUY_COLOR : SELL_COLOR,
      shape: isBuy ? "arrowUp" : "arrowDown",
      text: marker.label ?? (isBuy ? "B" : "S"),
    };
  });
}
