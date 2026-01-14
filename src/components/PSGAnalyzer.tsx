import React, { useState } from 'react';
import Papa from 'papaparse';
import Plot from 'react-plotly.js';

type Holding = {
  symbol: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  invested_value?: number;
  current_value?: number;
  pnl?: number;
  pnl_pct?: number;
  allocation_pct?: number;
};

const number = (v: any) => (v === null || v === undefined || v === '' ? 0 : Number(v));

export default function PSGAnalyzer() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [totalInvested, setTotalInvested] = useState(0);
  const [totalCurrent, setTotalCurrent] = useState(0);
  const [healthScore, setHealthScore] = useState<number | null>(null);

  const onFile = (file: File | null) => {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.toLowerCase().trim(),
      complete: (res: Papa.ParseResult<any>) => {
        const rows = res.data as any[];
        const required = ['symbol', 'quantity', 'avg_price', 'current_price'];
        const cols = Object.keys(rows[0] || {});
        const ok = required.every(r => cols.includes(r));
        if (!ok) {
          alert('CSV must contain: symbol, quantity, avg_price, current_price');
          return;
        }

        const parsed: Holding[] = rows
          .map(r => ({
            symbol: String(r.symbol).toUpperCase().trim(),
            quantity: Math.max(0, Math.floor(number(r.quantity))),
            avg_price: number(r.avg_price),
            current_price: number(r.current_price),
          }))
          .filter(x => x.quantity > 0);

        if (parsed.length === 0) {
          alert('No valid holdings found');
          return;
        }

        // calculations
        let invested = 0;
        let current = 0;
        parsed.forEach(p => {
          p.invested_value = p.quantity * p.avg_price;
          p.current_value = p.quantity * p.current_price;
          p.pnl = p.current_value - p.invested_value;
          p.pnl_pct = p.invested_value ? (p.pnl / p.invested_value) * 100 : 0;
          invested += p.invested_value || 0;
          current += p.current_value || 0;
        });

        parsed.forEach(p => {
          p.allocation_pct = current ? ((p.current_value || 0) / current) * 100 : 0;
        });

        // health score (replicates Streamlit logic)
        const hhi = parsed.reduce((acc, p) => acc + Math.pow((p.allocation_pct || 0) / 100, 2), 0);
        const effectiveN = hhi > 0 ? Math.floor(1 / hhi) : parsed.length;

        let concentration = hhi < 0.1 ? 100 : hhi < 0.18 ? 70 : 40;
        let diversification = effectiveN >= 50 ? 100 : effectiveN >= 30 ? 80 : effectiveN >= 15 ? 60 : 40;
        const microCount = parsed.filter(p => (p.allocation_pct || 0) < 0.1).length;
        let fragmentation = microCount < 20 ? 100 : microCount < 50 ? 70 : 40;
        const sorted = parsed.slice().sort((a, b) => (b.current_value || 0) - (a.current_value || 0));
        const top5 = sorted.slice(0, 5).reduce((s, it) => s + (it.allocation_pct || 0), 0);
        let dominance = top5 < 40 ? 100 : top5 < 60 ? 70 : 40;

        const score = Math.round(0.3 * concentration + 0.3 * diversification + 0.2 * fragmentation + 0.2 * dominance);

        setHoldings(parsed);
        setTotalInvested(invested);
        setTotalCurrent(current);
        setHealthScore(score);
      },
    });
  };

  const topPlot = () => {
    const sorted = holdings.slice().sort((a, b) => (b.current_value || 0) - (a.current_value || 0));
    const top = sorted.slice(0, 10);
    const others = sorted.slice(10).reduce((s, it) => s + (it.current_value || 0), 0);
    const labels = top.map(t => t.symbol).concat(others > 0 ? ['OTHERS'] : []);
    const values = top.map(t => t.current_value || 0).concat(others > 0 ? [others] : []);
    return { labels, values };
  };

  const { labels, values } = topPlot();

  return (
    <div>
      <div className="mb-4">
        <input
          type="file"
          accept="text/csv"
          onChange={e => onFile(e.target.files ? e.target.files[0] : null)}
        />
      </div>

      {holdings.length > 0 && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 border rounded">
              <div className="text-sm text-gray-500">Total Invested</div>
              <div className="text-xl font-semibold">₹ {totalInvested.toLocaleString()}</div>
            </div>
            <div className="p-4 border rounded">
              <div className="text-sm text-gray-500">Current Value</div>
              <div className="text-xl font-semibold">₹ {totalCurrent.toLocaleString()}</div>
            </div>
            <div className="p-4 border rounded">
              <div className="text-sm text-gray-500">Total P/L</div>
              <div className="text-xl font-semibold">₹ {(totalCurrent - totalInvested).toLocaleString()}</div>
            </div>
            <div className="p-4 border rounded">
              <div className="text-sm text-gray-500">Health Score</div>
              <div className="text-xl font-semibold">{healthScore}</div>
            </div>
          </div>

          <div className="mb-6">
            <Plot
              data={[{ labels, values, type: 'pie', hole: 0.3 }]}
              layout={{ title: 'Top Holdings Contribution', autosize: true }}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Holdings</h3>
            <div className="overflow-auto">
              <table className="min-w-full table-auto border-collapse">
                <thead>
                  <tr>
                    <th className="border px-2 py-1">Symbol</th>
                    <th className="border px-2 py-1">Quantity</th>
                    <th className="border px-2 py-1">Avg Price</th>
                    <th className="border px-2 py-1">Current Price</th>
                    <th className="border px-2 py-1">Current Value</th>
                    <th className="border px-2 py-1">P/L</th>
                    <th className="border px-2 py-1">Allocation %</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(h => (
                    <tr key={h.symbol}>
                      <td className="border px-2 py-1">{h.symbol}</td>
                      <td className="border px-2 py-1">{h.quantity}</td>
                      <td className="border px-2 py-1">{h.avg_price}</td>
                      <td className="border px-2 py-1">{h.current_price}</td>
                      <td className="border px-2 py-1">{(h.current_value || 0).toLocaleString()}</td>
                      <td className="border px-2 py-1">{(h.pnl || 0).toLocaleString()}</td>
                      <td className="border px-2 py-1">{(h.allocation_pct || 0).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
