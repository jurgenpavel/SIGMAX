"use client";
import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  ReferenceLine,
} from "recharts";

/* ==================== Helpers ==================== */
function parseNumbers(raw: string): number[] {
  return raw
    .split(/[\s,;\n\t]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => Number(t))
    .filter((n) => Number.isFinite(n));
}
const mean = (a: number[]) =>
  a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;

const variance = (a: number[], sample = true) => {
  if (a.length < (sample ? 2 : 1)) return NaN;
  const m = mean(a);
  const d = sample ? a.length - 1 : a.length;
  return a.reduce((acc, x) => acc + (x - m) ** 2, 0) / d;
};
const stdev = (a: number[], sample = true) => {
  const v = variance(a, sample);
  return Number.isFinite(v) ? Math.sqrt(v) : NaN;
};
const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mode = (a: number[]) => {
  if (!a.length) return null;
  const f = new Map<number, number>();
  for (const v of a) f.set(v, (f.get(v) ?? 0) + 1);
  let best = a[0],
    max = 0;
  for (const [k, c] of f.entries()) if (c > max) {
    best = k;
    max = c;
  }
  return best;
};
const round = (n: number, d = 4) =>
  Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : NaN;
const sturges = (n: number) => Math.max(4, Math.ceil(1 + Math.log2(Math.max(1, n))));

function histogramData(values: number[], bins?: number) {
  if (!values.length)
    return [] as { bin: string; x: number; count: number }[];
  const min = Math.min(...values),
    max = Math.max(...values);
  const k = bins ?? sturges(values.length);
  const width = (max - min) / k || 1;
  const buckets = Array.from({ length: k }, (_, i) => ({
    lo: min + i * width,
    hi: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= k) idx = k - 1;
    if (idx < 0) idx = 0;
    buckets[idx].count += 1;
  }
  return buckets.map((b) => ({
    bin: `${round(b.lo, 2)}–${round(b.hi, 2)}`,
    x: (b.lo + b.hi) / 2,
    count: b.count,
  }));
}
function normalPdf(x: number, mu: number, sigma: number) {
  if (!Number.isFinite(mu) || !Number.isFinite(sigma) || sigma <= 0) return 0;
  const c = 1 / (sigma * Math.sqrt(2 * Math.PI));
  return c * Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}
// erf/CDF
function erf(x: number) {
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741,
    a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + p * ax);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-ax * ax);
  return sign * y;
}
const phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

/* ==================== App ==================== */
const SIGMAX_LOGO = "https://i.imgur.com/xdr2Qu9.png"; // si no es directo, se verá “Σ”

export default function Page() {
  const [name, setName] = useState("");
  const [raw, setRaw] = useState("");
  const [T, setT] = useState<string>("");
  const [tol, setTol] = useState<string>("");
  const [sampleStd, setSampleStd] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const values = useMemo(() => parseNumbers(raw), [raw]);
  const sorted = useMemo(() => [...values].sort((a, b) => a - b), [values]);

  const tNum = Number(T);
  const tolNum = Number(tol);
  // NOTA: aquí la tolerancia es “total” ±Tol/2 a cada lado
  const lsl = Number.isFinite(tNum) && Number.isFinite(tolNum) ? tNum - tolNum / 2 : NaN;
  const usl = Number.isFinite(tNum) && Number.isFinite(tolNum) ? tNum + tolNum / 2 : NaN;

  const stats = useMemo(() => {
    const n = values.length;
    const mu = mean(values);
    const sig = stdev(values, sampleStd);
    const sigGlobal = stdev(values, false);
    const med = median(values);
    const mo = mode(values);
    const min = values.length ? Math.min(...values) : NaN;
    const max = values.length ? Math.max(...values) : NaN;
    const R = Number.isFinite(min) && Number.isFinite(max) ? max - min : NaN;
    const Tused = Number.isFinite(tNum)
      ? tNum
      : Number.isFinite(lsl) && Number.isFinite(usl)
      ? (lsl + usl) / 2
      : NaN;

    const cp = Number.isFinite(usl) && Number.isFinite(lsl) && sig > 0 ? (usl - lsl) / (6 * sig) : NaN;
    const cpi = Number.isFinite(lsl) && sig > 0 ? (mu - lsl) / (3 * sig) : NaN;
    const cps = Number.isFinite(usl) && sig > 0 ? (usl - mu) / (3 * sig) : NaN;
    const cpk = Math.min(cpi, cps);
    const cpm =
      Number.isFinite(usl) && Number.isFinite(lsl) && sig > 0 && Number.isFinite(Tused)
        ? (usl - lsl) / (6 * Math.sqrt(sig ** 2 + (mu - Tused) ** 2))
        : NaN;

    const Cr = Number.isFinite(cp) && cp > 0 ? 1 / cp : NaN;
    const specHalf = Number.isFinite(usl) && Number.isFinite(lsl) ? (usl - lsl) / 2 : NaN;
    const K =
      Number.isFinite(specHalf) && specHalf > 0 && Number.isFinite(mu) && Number.isFinite(Tused)
        ? Math.abs(mu - Tused) / specHalf
        : NaN;

    const ZUSL = Number.isFinite(usl) && sig > 0 ? (usl - mu) / sig : NaN;
    const ZLSL = Number.isFinite(lsl) && sig > 0 ? (mu - lsl) / sig : NaN;
    const Zmin = Math.min(ZUSL, ZLSL);
    const ppmTwo =
      Number.isFinite(ZUSL) && Number.isFinite(ZLSL) ? (1 - phi(ZUSL) + 1 - phi(ZLSL)) * 1_000_000 : NaN;
    const yieldPct = Number.isFinite(ppmTwo) ? (1 - ppmTwo / 1_000_000) * 100 : NaN;
    const sigmaLevel = Zmin;
    const sigmaShifted = Number.isFinite(Zmin) ? Zmin + 1.5 : NaN;

    const Pp = Number.isFinite(usl) && Number.isFinite(lsl) && sigGlobal > 0 ? (usl - lsl) / (6 * sigGlobal) : NaN;
    const Ppi = Number.isFinite(lsl) && sigGlobal > 0 ? (mu - lsl) / (3 * sigGlobal) : NaN;
    const Pps = Number.isFinite(usl) && sigGlobal > 0 ? (usl - mu) / (3 * sigGlobal) : NaN;
    const Ppk = Math.min(Ppi, Pps);

    const oos = values.filter((v) => (Number.isFinite(lsl) && v < lsl) || (Number.isFinite(usl) && v > usl)).length;
    const ppmObs = n ? (oos / n) * 1_000_000 : NaN;

    return {
      n,
      mu,
      sig,
      sigGlobal,
      med,
      mo,
      min,
      max,
      R,
      Tused,
      cp,
      cpi,
      cps,
      cpk,
      cpm,
      Cr,
      K,
      ZUSL,
      ZLSL,
      Zmin,
      ppmTwo,
      yieldPct,
      sigmaLevel,
      sigmaShifted,
      Pp,
      Ppk,
      oos,
      ppmObs,
    };
  }, [values, sampleStd, lsl, usl, tNum]);

  const hist = useMemo(() => histogramData(values), [values]);
  const chartData = useMemo(() => {
    if (!hist.length || !Number.isFinite(stats.mu) || !Number.isFinite(stats.sig) || stats.sig <= 0)
      return [] as any[];
    const peak = Math.max(...hist.map((h) => h.count)) || 1;
    const pdfVals = hist.map((h) => normalPdf(h.x, stats.mu, stats.sig));
    const maxPdf = Math.max(...pdfVals) || 1;
    return hist.map((h, i) => ({ ...h, pdf: (pdfVals[i] / maxPdf) * peak }));
  }, [hist, stats.mu, stats.sig]);

  function cpDecision(cp: number) {
    if (!Number.isFinite(cp))
      return { cls: "—", decision: "Insuficiente información" };
    if (cp > 2) return { cls: "Clase mundial", decision: "Tiene calidad seis sigma" };
    if (cp >= 1.33 && cp <= 2) return { cls: "1", decision: "Más que adecuado" };
    if (cp >= 1 && cp < 1.33) return { cls: "2", decision: "Adecuado con control estricto" };
    if (cp >= 0.67 && cp < 1) return { cls: "3", decision: "No adecuado; requiere modificaciones serias" };
    return { cls: "4", decision: "No adecuado; requiere modificaciones serias" };
  }
  const decision = useMemo(() => cpDecision(stats.cp), [stats.cp]);

  // armamos los KPIs fuera del JSX para evitar paréntesis/llaves raras
  const kpiList: { label: string; value: number | string }[] = [
    { label: "Cp", value: stats.cp },
    { label: "Cpk", value: stats.cpk },
    { label: "Cpi", value: stats.cpi },
    { label: "Cps", value: stats.cps },
    { label: "Cpm", value: stats.cpm },
    { label: "Cr = 1/Cp", value: stats.Cr },
    { label: "K (descentrado)", value: stats.K },
    { label: "ZUSL", value: stats.ZUSL },
    { label: "ZLSL", value: stats.ZLSL },
    { label: "Zmin", value: stats.Zmin },
    { label: "PPM (2 lados)", value: Number.isFinite(stats.ppmTwo) ? Math.round(Number(stats.ppmTwo)) : "—" },
    { label: "Yield %", value: Number.isFinite(stats.yieldPct) ? `${round(Number(stats.yieldPct), 2)}%` : "—" },
    { label: "Sigma (Z)", value: stats.sigmaLevel },
    { label: "Sigma +1.5", value: stats.sigmaShifted },
    { label: "Pp", value: stats.Pp },
    { label: "Ppk", value: stats.Ppk },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center gap-3">
        <img
          src={SIGMAX_LOGO}
          alt="SIGMAX"
          className="w-10 h-10 rounded hidden sm:block"
          onError={(e) => {
            (e.currentTarget as any).style.display = "none";
          }}
        />
        <div className="w-10 h-10 rounded bg-emerald-700/10 flex items-center justify-center ring-1 ring-emerald-700/20 sm:hidden">
          <span className="text-emerald-800 font-bold">Σ</span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-emerald-900">SIGMAX</h1>
          <p className="text-gray-600 text-sm">Calculadora de Capacidad de Proceso</p>
        </div>
      </header>

      {/* Entradas */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-emerald-900 mb-1">
            Datos del muestreo
          </label>
          <textarea
            className="w-full h-40 rounded-2xl border p-3"
            placeholder="50 51 53 57 55 52 51 ..."
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 content-start">
          <div className="col-span-2">
            <label className="block text-sm font-medium">Nombre de pieza/proceso</label>
            <input
              className="w-full rounded-xl border p-2"
              placeholder="Eje 12mm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Nominal (T)</label>
            <input
              inputMode="decimal"
              className="w-full rounded-xl border p-2"
              placeholder="55"
              value={T}
              onChange={(e) => setT(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Tolerancia total (±)</label>
            <input
              inputMode="decimal"
              className="w-full rounded-xl border p-2"
              placeholder="8 (=> LSL=T-4, USL=T+4)"
              value={tol}
              onChange={(e) => setTol(e.target.value)}
            />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              id="sampleStd"
              type="checkbox"
              checked={sampleStd}
              onChange={() => setSampleStd(!sampleStd)}
            />
            <label htmlFor="sampleStd" className="text-sm">
              Desviación Estándar Muestral (n−1)
            </label>
          </div>
        </div>
        <div className="md:col-span-1">
  <label className="block text-sm font-medium text-emerald-900 mb-1">
    Pieza/Proceso
  </label>

  <div className="rounded-2xl border p-4 text-center flex flex-col items-center justify-center gap-3 min-h-40 w-full overflow-hidden">
    {photoUrl ? (
      <img
        src={photoUrl}
        alt="pieza"
        className="w-full max-h-48 object-contain rounded-xl"
      />
    ) : (
      <div className="text-sm text-gray-500">Sube una foto (opcional)</div>
    )}

    {/* Input de archivo adaptado al contenedor */}
    <input
      type="file"
      accept="image/*"
      className="w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-900 hover:file:bg-emerald-100"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const u = URL.createObjectURL(f);
        setPhotoUrl(u);
      }}
    />

    {photoUrl && (
      <button
        className="px-3 py-2 rounded-xl border hover:bg-gray-50"
        onClick={() => setPhotoUrl(null)}
      >
        Quitar foto
      </button>
    )}
  </div>
</div>

      {/* Gráfica + panel lateral */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 rounded-2xl border p-4">
          <h2 className="text-lg font-semibold mb-2">Histograma y curva normal</h2>
          <div className="w-full h-80">
            <ResponsiveContainer>
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 30, bottom: 10, left: 0 }}
              >
                <XAxis dataKey="bin" interval={0} angle={-35} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip formatter={(v: any) => (Array.isArray(v) ? v[0] : v)} />
                <Bar dataKey="count" barSize={24} />
                <Line type="monotone" dataKey="pdf" dot={false} strokeWidth={2} />
                {Number.isFinite(lsl) && chartData.length > 0 && (
                  <ReferenceLine
                    x={
                      chartData.reduce((best, h) =>
                        Math.abs(h.x - lsl) <
                        Math.abs((best?.x ?? Infinity) - lsl)
                          ? h
                          : best,
                      chartData[0]).bin
                    }
                  />
                )}
                {Number.isFinite(usl) && chartData.length > 0 && (
                  <ReferenceLine
                    x={
                      chartData.reduce((best, h) =>
                        Math.abs(h.x - usl) <
                        Math.abs((best?.x ?? Infinity) - usl)
                          ? h
                          : best,
                      chartData[0]).bin
                    }
                  />
                )}
                {Number.isFinite(tNum) && chartData.length > 0 && (
                  <ReferenceLine
                    x={
                      chartData.reduce((best, h) =>
                        Math.abs(h.x - tNum) <
                        Math.abs((best?.x ?? Infinity) - tNum)
                          ? h
                          : best,
                      chartData[0]).bin
                    }
                  />
                )}
                {Number.isFinite(stats.mu) && chartData.length > 0 && (
                  <ReferenceLine
                    x={
                      chartData.reduce((best, h) =>
                        Math.abs(h.x - stats.mu) <
                        Math.abs((best?.x ?? Infinity) - stats.mu)
                          ? h
                          : best,
                      chartData[0]).bin
                    }
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border p-4 space-y-3">
          <h3 className="font-semibold">Pieza/Proceso</h3>
          <div className="text-sm text-gray-700">{name || "—"}</div>
          {photoUrl ? (
            <img src={photoUrl} className="w-full rounded-xl" alt="pieza" />
          ) : (
            <div className="text-sm text-gray-500">Sin imagen</div>
          )}
          <div className="text-sm grid grid-cols-2 gap-2">
            <div className="text-gray-600">T</div>
            <div className="font-medium">{Number.isFinite(tNum) ? round(tNum) : "—"}</div>
            <div className="text-gray-600">LSL</div>
            <div className="font-medium">{Number.isFinite(lsl) ? round(lsl) : "—"}</div>
            <div className="text-gray-600">USL</div>
            <div className="font-medium">{Number.isFinite(usl) ? round(usl) : "—"}</div>
          </div>
        </div>
      </div>

      {/* Resumen + KPIs */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="rounded-2xl border p-4">
          <h2 className="text-lg font-semibold mb-2">Resumen estadístico</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-600">N</div>
            <div className="font-medium">{stats.n}</div>
            <div className="text-gray-600">LSL</div>
            <div className="font-medium">{Number.isFinite(lsl) ? round(lsl) : "—"}</div>
            <div className="text-gray-600">USL</div>
            <div className="font-medium">{Number.isFinite(usl) ? round(usl) : "—"}</div>
            <div className="text-gray-600">Nominal (T)</div>
            <div className="font-medium">
              {Number.isFinite(stats.Tused) ? round(stats.Tused) : "—"}
            </div>
            <div className="text-gray-600">Media (x̄)</div>
            <div className="font-medium">{round(stats.mu)}</div>
            <div className="text-gray-600">
              σ ({sampleStd ? "muestral" : "población"})
            </div>
            <div className="font-medium">{round(stats.sig)}</div>
            <div className="text-gray-600">σ global (Pp)</div>
            <div className="font-medium">{round(stats.sigGlobal)}</div>
            <div className="text-gray-600">Mediana</div>
            <div className="font-medium">{round(stats.med)}</div>
            <div className="text-gray-600">Moda</div>
            <div className="font-medium">
              {stats.mo === null ? "—" : round(stats.mo)}
            </div>
            <div className="text-gray-600">Rango (R)</div>
            <div className="font-medium">{round(stats.R)}</div>
            <div className="text-gray-600">Mínimo</div>
            <div className="font-medium">{round(stats.min)}</div>
            <div className="text-gray-600">Máximo</div>
            <div className="font-medium">{round(stats.max)}</div>
            <div className="text-gray-600">Fuera de espec.</div>
            <div className="font-medium">
              {`${stats.oos} (${stats.n ? round((stats.oos / stats.n) * 100, 2) : 0}%)`}
            </div>
            <div className="text-gray-600">PPM (observado)</div>
            <div className="font-medium">
              {Number.isFinite(stats.ppmObs) ? Math.round(stats.ppmObs) : "—"}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border p-4 md:col-span-2">
          <h2 className="text-lg font-semibold mb-2">Índices de capacidad y desempeño</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            {kpiList.map((k) => (
              <div key={k.label} className="flex justify-between border-b py-1">
                <span className="text-gray-600">{k.label}</span>
                <span className="font-medium">
                  {typeof k.value === "number" && Number.isFinite(k.value)
                    ? String(round(k.value))
                    : String(k.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Clasificación */}
      <div className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-2">Clasificación del proceso según Cp</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl p-4 border">
            <div className="text-sm text-gray-600">Clase</div>
            <div className="text-2xl font-semibold">{decision.cls}</div>
          </div>
          <div className="rounded-2xl p-4 border">
            <div className="text-sm text-gray-600">Cp</div>
            <div className="text-2xl font-semibold">
              {Number.isFinite(stats.cp) ? round(stats.cp) : "—"}
            </div>
          </div>
          <div className="rounded-2xl p-4 border">
            <div className="text-sm text-gray-600">Decisión</div>
            <div className="text-lg font-medium">{decision.decision}</div>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-3">
          Reglas: Cp &gt; 2 (clase mundial); 1.33 ≤ Cp ≤ 2 (Clase 1); 1 ≤ Cp &lt; 1.33 (Clase 2);
          0.67 ≤ Cp &lt; 1 (Clase 3); Cp &lt; 0.67 (Clase 4).
        </p>
      </div>

      {/* Muestra ordenada */}
      <div className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-2">Muestra ordenada (ascendente)</h2>
        {sorted.length ? (
          <div className="max-h-60 overflow-auto border rounded-xl p-3 text-sm">
            <div className="grid grid-cols-6 gap-2">
              {sorted.map((v, i) => (
                <div key={i} className="text-gray-800">
                  {round(v)}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Sin datos</div>
        )}
      </div>
    </div>
  );
}

