import type { CSSProperties } from "react";
import styles from "./book-art.module.css";

const RIGHT_BOARD = "M160 38H294a8 8 0 0 1 8 8V164a8 8 0 0 1-8 8H160Z";
const LEFT_BOARD = "M160 38H26a8 8 0 0 0-8 8V164a8 8 0 0 0 8 8H160Z";
const RIGHT_EDGE = "M160 40C190 28 250 28 292 38V164C250 154 190 154 160 166Z";
const LEFT_EDGE = "M160 40C130 28 70 28 28 38V164C70 154 130 154 160 166Z";
const RIGHT_PAGE = "M160 34C190 22 250 22 288 32V156C250 146 190 146 160 158Z";
const LEFT_PAGE = "M160 34C130 22 70 22 32 32V156C70 146 130 146 160 158Z";
const RIGHT_LINES = "M178 54Q224 46 270 56M178 70Q224 62 270 72M178 86Q224 78 270 88M178 102Q224 94 270 104M178 118Q208 113 236 116";
const LEFT_LINES = "M50 56Q96 46 142 54M50 72Q96 62 142 70M50 88Q96 78 142 86M50 104Q96 94 142 102M50 120Q78 114 106 114";

const start = (a: number) => ({ "--a": a }) as CSSProperties;

function Page({ d, lines }: { d: string; lines: string }) {
  return (
    <>
      <path d={d} fill="hsl(var(--card))" stroke="hsl(var(--border))" />
      <path d={lines} fill="none" stroke="hsl(var(--border))" strokeWidth="3" strokeLinecap="round" />
    </>
  );
}

/**
 * Decorative book drawn from the theme tokens. Its state follows the CSS variable --p
 * (see book-art.module.css); with nothing setting --p it renders open with the ribbon down.
 */
export function BookArt() {
  return (
    <svg viewBox="0 0 320 200" aria-hidden="true" focusable="false" className="block h-auto w-full">
      <g className={styles.shift}>
        {/* right half: back board and the pages that never move */}
        <ellipse cx="231" cy="180" rx="70" ry="6" fill="hsl(var(--foreground) / 0.06)" />
        <path d={RIGHT_BOARD} fill="hsl(var(--primary))" />
        <g className={styles.spread}>
          <path d={RIGHT_EDGE} fill="hsl(var(--muted))" stroke="hsl(var(--border))" />
          <Page d={RIGHT_PAGE} lines={RIGHT_LINES} />
        </g>

        {/* the front cover swings over to become the left board */}
        <g className={styles.back} style={start(0.05)}>
          <ellipse cx="89" cy="180" rx="70" ry="6" fill="hsl(var(--foreground) / 0.06)" />
          <path d={LEFT_BOARD} fill="hsl(var(--primary))" />
          <path d={LEFT_EDGE} fill="hsl(var(--muted))" stroke="hsl(var(--border))" />
        </g>

        {/* two leaves turn from right to left */}
        <g className={styles.spread}>
          {[0.5, 0.3].map((a) => (
            <g key={a} className={styles.front} style={start(a)}>
              <Page d={RIGHT_PAGE} lines={RIGHT_LINES} />
            </g>
          ))}
        </g>
        {[0.3, 0.5].map((a) => (
          <g key={a} className={styles.back} style={start(a)}>
            <Page d={LEFT_PAGE} lines={LEFT_LINES} />
          </g>
        ))}

        <g className={styles.front} style={start(0.05)}>
          <path d={RIGHT_BOARD} fill="hsl(var(--primary))" />
          <rect x="174" y="52" width="114" height="106" rx="4" fill="none" stroke="hsl(var(--primary-foreground) / 0.25)" />
        </g>
        <path d="M160 34V158" stroke="hsl(var(--border))" className={styles.spread} />

        {/* the ribbon ends lower left, toward the last step of the walkthrough */}
        <path
          className={styles.ribbon}
          d="M163 31C161 84 124 132 82 184"
          pathLength="1"
          fill="none"
          stroke="hsl(var(--chart-1))"
          strokeWidth="11"
        />
      </g>
    </svg>
  );
}
