import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { LatencyBucket } from '../../../shared/equipment';
import { useI18n } from '../../i18n';
import { formatClock } from '../../utils/time';

const HEIGHT = 240;
const PAD = { top: 14, right: 14, bottom: 28, left: 56 };

function niceMax(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 2.5, 5, 10].find((step) => step * magnitude >= value) ?? 10) * magnitude;
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Sequências de intervalos consecutivos com latência medida. */
function dataRuns(buckets: LatencyBucket[]): number[][] {
  const runs: number[][] = [];
  let current: number[] = [];
  buckets.forEach((bucket, i) => {
    if (bucket.avgLatencyMs !== null) current.push(i);
    else if (current.length) {
      runs.push(current);
      current = [];
    }
  });
  if (current.length) runs.push(current);
  return runs;
}

interface LatencyChartProps {
  buckets: LatencyBucket[];
  bucketMs: number;
  thresholdMs: number;
}

export function LatencyChart({ buckets, bucketMs, thresholdMs }: LatencyChartProps) {
  const { t } = useI18n();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  if (buckets.every((b) => b.checks === 0)) {
    return (
      <div className="chart" ref={ref}>
        <p className="chart__empty">{t.chart.empty}</p>
      </div>
    );
  }

  const peak = Math.max(0, ...buckets.map((b) => b.maxLatencyMs ?? 0));
  const yMax = niceMax(Math.max(peak, 100));
  const plotWidth = Math.max(0, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotWidth / buckets.length;
  const x = (i: number) => PAD.left + slot * (i + 0.5);
  const y = (ms: number) => PAD.top + plotHeight * (1 - Math.min(ms, yMax) / yMax);

  const runs = dataRuns(buckets);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));
  const tickEveryHours = width < 560 ? 6 : 3;
  const xTicks = buckets
    .map((b, i) => ({ i, date: new Date(b.at) }))
    .filter(({ date }) => date.getMinutes() === 0 && date.getHours() % tickEveryHours === 0);

  const handlePointer = (event: PointerEvent<SVGSVGElement>) => {
    const left = event.currentTarget.getBoundingClientRect().left;
    const index = Math.floor((event.clientX - left - PAD.left) / slot);
    setHover(index >= 0 && index < buckets.length ? index : null);
  };

  const hovered = hover !== null ? buckets[hover] : null;

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          className="chart__svg"
          onPointerMove={handlePointer}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={t.chart.ariaLabel}
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line className="chart__grid" x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} />
              <text className="chart__label" x={PAD.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">
                {tick} ms
              </text>
            </g>
          ))}

          {xTicks.map(({ i, date }) => (
            <text key={i} className="chart__label" x={PAD.left + slot * i} y={HEIGHT - 8} textAnchor="middle">
              {String(date.getHours()).padStart(2, '0')}h
            </text>
          ))}

          {buckets.map((b, i) =>
            b.failures > 0 ? (
              <rect
                key={`f${i}`}
                className="chart__failure"
                x={PAD.left + slot * i}
                y={PAD.top}
                width={Math.max(slot, 2)}
                height={plotHeight}
                opacity={0.2 + 0.5 * (b.failures / b.checks)}
              />
            ) : null,
          )}

          {thresholdMs <= yMax && (
            <line className="chart__threshold" x1={PAD.left} x2={width - PAD.right} y1={y(thresholdMs)} y2={y(thresholdMs)} />
          )}

          {runs.map((run) => {
            const top = run.map((i) => `${x(i)},${y(buckets[i].maxLatencyMs!)}`);
            const bottom = run.map((i) => `${x(i)},${y(buckets[i].minLatencyMs!)}`).reverse();
            const line = run.map((i, n) => `${n ? 'L' : 'M'}${x(i)},${y(buckets[i].avgLatencyMs!)}`).join(' ');
            return (
              <g key={run[0]}>
                {run.length > 1 && <polygon className="chart__band" points={[...top, ...bottom].join(' ')} />}
                {run.length > 1 ? (
                  <path className="chart__line" d={line} />
                ) : (
                  <circle className="chart__dot" cx={x(run[0])} cy={y(buckets[run[0]].avgLatencyMs!)} r={2.5} />
                )}
              </g>
            );
          })}

          {hover !== null && <line className="chart__cursor" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotHeight} />}
        </svg>
      )}

      {hovered && hover !== null && (
        <div
          className="chart__tooltip"
          style={{ left: Math.min(Math.max(x(hover), 90), width - 90) }}
        >
          <strong>
            {formatClock(hovered.at)}–{formatClock(new Date(Date.parse(hovered.at) + bucketMs).toISOString())}
          </strong>
          {hovered.checks === 0 ? (
            <span>{t.chart.noChecks}</span>
          ) : (
            <>
              {hovered.avgLatencyMs !== null && (
                <span>{t.chart.stats(hovered.avgLatencyMs, hovered.minLatencyMs, hovered.maxLatencyMs)}</span>
              )}
              <span>
                {t.chart.checks(hovered.checks)}
                {hovered.failures > 0 && ` · ${t.chart.failures(hovered.failures)}`}
                {hovered.drops > 0 && ` · ${t.chart.drops(hovered.drops)}`}
              </span>
            </>
          )}
        </div>
      )}

      <div className="chart__legend">
        <span>
          <i className="chart__swatch chart__swatch--line" /> {t.chart.averageLatency}
        </span>
        <span>
          <i className="chart__swatch chart__swatch--band" /> {t.chart.minMax}
        </span>
        <span>
          <i className="chart__swatch chart__swatch--failure" /> {t.chart.failuresLegend}
        </span>
        {thresholdMs <= yMax && (
          <span>
            <i className="chart__swatch chart__swatch--threshold" /> {t.chart.threshold(thresholdMs)}
          </span>
        )}
      </div>
    </div>
  );
}
