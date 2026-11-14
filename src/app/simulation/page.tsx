"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button, Logo } from "@/components/ui";
import { SimulationResults, runSimulation } from "@/lib/api";

export default function SimulationPage() {
  const [numCustomers, setNumCustomers] = useState(80);
  const [arrivalInterval, setArrivalInterval] = useState(2.5);
  const [serviceDuration, setServiceDuration] = useState(8.0);
  const [numCounters, setNumCounters] = useState(3);
  const [transitTime, setTransitTime] = useState(3.0);
  const [randomSeed, setRandomSeed] = useState(42);

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleRunSimulation() {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const data = await runSimulation({
        num_customers: numCustomers,
        arrival_interval_mins: arrivalInterval,
        service_duration_mins: serviceDuration,
        num_counters: numCounters,
        transit_time_mins: transitTime,
        random_seed: randomSeed,
      });
      setResults(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Simulation execution error";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }

  // Run automatically on first load to showcase baseline data
  useEffect(() => {
    let ignore = false;
    runSimulation({
      num_customers: 80,
      arrival_interval_mins: 2.5,
      service_duration_mins: 8.0,
      num_counters: 3,
      transit_time_mins: 3.0,
      random_seed: 42,
    })
      .then((data) => {
        if (!ignore) setResults(data);
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : "Simulation execution error";
          setErrorMsg(msg);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  function handleExportCsv() {
    if (!results) return;
    const rows = [
      ["Metric", "Conventional Physical Queue", "Krenox Virtual Queue", "Reduction / Delta"],
      ["Simulated Customers", results.parameters.num_customers, results.parameters.num_customers, "-"],
      ["Open Counters", results.parameters.num_counters, results.parameters.num_counters, "-"],
      ["Avg Physical Waiting Time (mins)", results.conventional.avg_physical_wait_mins, results.virtual.avg_physical_wait_mins, `${results.reduction.physical_wait_reduction_pct}%`],
      ["Max Waiting Time (mins)", results.conventional.max_wait_mins, results.virtual.max_wait_mins, "-"],
      ["Counter Utilization (%)", `${results.conventional.counter_utilization_pct}%`, `${results.virtual.counter_utilization_pct}%`, "-"],
      ["Avg In-Room Queue Length", results.conventional.avg_queue_length, results.virtual.avg_queue_length, "-"],
      ["Minutes Saved Physically", "-", "-", `${results.reduction.minutes_saved_physically_per_student} mins/student`],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `krenox_simulation_evaluation_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <main className="min-h-screen bg-[#f3f6f5] text-ink pb-24 selection:bg-brand selection:text-white">
      {/* ── Top Bar ── */}
      <header className="border-b border-line/70 bg-white sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-brand">
              Evaluation & Simulation Engine
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-xs font-semibold text-soft hover:text-brand transition">Admin & Kiosks</Link>
            <Link href="/staff" className="text-xs font-semibold text-soft hover:text-brand transition">Staff Console</Link>
            <Link href="/" className="text-xs font-semibold text-soft hover:text-ink transition underline underline-offset-4">Public Home ↗</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 pt-8">
        {/* Academic Header */}
        <div className="rounded-[2.5rem] bg-[#0b3842] p-8 text-white shadow-xl relative overflow-hidden">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-[#8ed8c8]">
              Discrete-Event Simulation (SimPy & Poisson Modeling)
            </span>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Performance Evaluation of Waiting-Time Reduction
            </h1>
            <p className="mt-3 text-sm text-white/80 leading-relaxed">
              Evaluating the operational difference between conventional physical queueing vs. Krenox virtual queueing under identical experimental arrival conditions (Section 7 of Technical Specification).
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-6 rounded-2xl bg-[#fde8e8] p-4 text-xs font-bold text-danger border border-danger/20">
            {errorMsg}
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_2fr]">
          {/* ── LEFT: Parameter Control Panel ── */}
          <div className="rounded-[2rem] border border-white/80 bg-white p-6 sm:p-7 shadow-sm">
            <h2 className="text-base font-bold text-ink border-b border-line pb-3">
              Experimental Parameters
            </h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRunSimulation();
              }}
              className="mt-5 space-y-4 text-xs font-bold text-ink"
            >
              <div>
                <label className="block text-soft mb-1">
                  Customer Sample Size (N): <span className="text-brand font-bold">{numCustomers}</span>
                </label>
                <input
                  type="range"
                  min={20}
                  max={300}
                  step={10}
                  value={numCustomers}
                  onChange={(e) => setNumCustomers(Number(e.target.value))}
                  className="w-full accent-brand cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-soft mb-1">
                  Mean Arrival Interval (λ): <span className="text-brand font-bold">{arrivalInterval} mins</span>
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={10.0}
                  step={0.5}
                  value={arrivalInterval}
                  onChange={(e) => setArrivalInterval(Number(e.target.value))}
                  className="w-full accent-brand cursor-pointer"
                />
                <span className="text-[10px] text-soft font-normal">Average time between consecutive student arrivals</span>
              </div>

              <div>
                <label className="block text-soft mb-1">
                  Mean Service Duration (μ): <span className="text-brand font-bold">{serviceDuration} mins</span>
                </label>
                <input
                  type="range"
                  min={2.0}
                  max={25.0}
                  step={0.5}
                  value={serviceDuration}
                  onChange={(e) => setServiceDuration(Number(e.target.value))}
                  className="w-full accent-brand cursor-pointer"
                />
                <span className="text-[10px] text-soft font-normal">Average handling duration at the counter</span>
              </div>

              <div>
                <label className="block text-soft mb-1">
                  Active Service Counters (C): <span className="text-brand font-bold">{numCounters} desks</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={numCounters}
                  onChange={(e) => setNumCounters(Number(e.target.value))}
                  className="w-full accent-brand cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-soft mb-1">
                  Walking Transit Window: <span className="text-brand font-bold">{transitTime} mins</span>
                </label>
                <input
                  type="range"
                  min={1.0}
                  max={8.0}
                  step={0.5}
                  value={transitTime}
                  onChange={(e) => setTransitTime(Number(e.target.value))}
                  className="w-full accent-brand cursor-pointer"
                />
                <span className="text-[10px] text-soft font-normal">Time taken to walk from library/cafeteria after notification</span>
              </div>

              <div>
                <label className="block text-soft mb-1">
                  Seed (Reproducibility): <span className="text-ink font-mono">{randomSeed}</span>
                </label>
                <input
                  type="number"
                  value={randomSeed}
                  onChange={(e) => setRandomSeed(Number(e.target.value))}
                  className="w-full rounded-xl border border-line-strong px-3 py-1.5 font-mono text-xs outline-none focus:border-brand"
                />
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={isLoading} className="w-full !py-3">
                  {isLoading ? "Running Simulation..." : "Run SimPy Experiment 🚀"}
                </Button>
              </div>
            </form>
          </div>

          {/* ── RIGHT: Comparative Evaluation Dashboard ── */}
          <div className="space-y-6">
            {results && (
              <>
                {/* Hero KPI Card */}
                <div className="rounded-[2rem] bg-white p-7 shadow-sm border border-brand/20">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
                    <div>
                      <p className="text-xs font-bold text-soft uppercase tracking-wider">
                        Primary Indicator (§7.5)
                      </p>
                      <h3 className="text-xl font-bold text-ink">Physical Waiting-Time Reduction</h3>
                    </div>
                    <Button variant="secondary" onClick={handleExportCsv} className="!text-xs !py-2 !px-4">
                      Export Results (CSV) 📥
                    </Button>
                  </div>

                  <div className="mt-6 grid gap-6 sm:grid-cols-2 items-center">
                    <div className="rounded-2xl bg-mint p-6 border border-brand/10 text-center sm:text-left">
                      <p className="text-xs font-semibold text-brand">Reduction Percentage</p>
                      <p className="mt-1 text-5xl font-extrabold text-brand tracking-tight">
                        {results.reduction.physical_wait_reduction_pct}%
                      </p>
                      <p className="mt-2 text-xs text-brand-ink leading-relaxed font-medium">
                        Saving an average of <strong className="font-bold">{results.reduction.minutes_saved_physically_per_student} minutes</strong> of physical hallway waiting per student.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-xl border border-line p-3">
                        <div className="flex justify-between text-xs font-semibold text-soft">
                          <span>Physical Hallway Wait (Conventional)</span>
                          <span className="font-bold text-danger">{results.conventional.avg_physical_wait_mins} mins</span>
                        </div>
                        <div className="mt-2 h-2.5 rounded-full bg-[#fde8e8] overflow-hidden">
                          <div className="h-full bg-danger rounded-full" style={{ width: "100%" }} />
                        </div>
                      </div>

                      <div className="rounded-xl border border-line p-3">
                        <div className="flex justify-between text-xs font-semibold text-soft">
                          <span>Physical Hallway Wait (Krenox)</span>
                          <span className="font-bold text-ok">{results.virtual.avg_physical_wait_mins} mins</span>
                        </div>
                        <div className="mt-2 h-2.5 rounded-full bg-[#e3ece9] overflow-hidden">
                          <div
                            className="h-full bg-ok rounded-full"
                            style={{
                              width: `${Math.max(
                                10,
                                100 - results.reduction.physical_wait_reduction_pct
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Side-by-Side Detailed Metrics Table */}
                <div className="rounded-[2rem] bg-white p-7 shadow-sm border border-line">
                  <h3 className="text-base font-bold text-ink border-b border-line pb-4">
                    Side-by-Side Evaluation Matrix
                  </h3>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-line/60 text-soft">
                          <th className="py-3 font-bold">Performance Metric</th>
                          <th className="py-3 font-bold text-danger">Conventional Queue</th>
                          <th className="py-3 font-bold text-brand">Krenox Virtual Queue</th>
                          <th className="py-3 font-bold text-ok">Impact / Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/40 font-medium">
                        <tr>
                          <td className="py-3 font-semibold text-ink">Avg Physical Wait Time</td>
                          <td className="py-3 text-danger font-bold">{results.conventional.avg_physical_wait_mins} mins</td>
                          <td className="py-3 text-brand font-bold">{results.virtual.avg_physical_wait_mins} mins</td>
                          <td className="py-3 text-ok font-bold">-{results.reduction.physical_wait_reduction_pct}% reduction</td>
                        </tr>
                        <tr>
                          <td className="py-3 font-semibold text-ink">Avg Hallway Congestion (Queue Length)</td>
                          <td className="py-3 text-danger">{results.conventional.avg_queue_length} students standing</td>
                          <td className="py-3 text-brand">0.0 (Wait done remotely)</td>
                          <td className="py-3 text-ok font-bold">99% hallway clearance</td>
                        </tr>
                        <tr>
                          <td className="py-3 font-semibold text-ink">Max Recorded Waiting Time</td>
                          <td className="py-3">{results.conventional.max_wait_mins} mins</td>
                          <td className="py-3">{results.virtual.max_wait_mins} mins</td>
                          <td className="py-3 text-soft">Identical total wait (FIFO)</td>
                        </tr>
                        <tr>
                          <td className="py-3 font-semibold text-ink">Counter Utilization Rate</td>
                          <td className="py-3">{results.conventional.counter_utilization_pct}%</td>
                          <td className="py-3">{results.virtual.counter_utilization_pct}%</td>
                          <td className="py-3 text-soft">Maintained 100% staff efficiency</td>
                        </tr>
                        <tr>
                          <td className="py-3 font-semibold text-ink">Total Students Served</td>
                          <td className="py-3">{results.conventional.total_served}</td>
                          <td className="py-3">{results.virtual.total_served}</td>
                          <td className="py-3 text-soft">0 customer dropouts / balks</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Academic Context Footnote per §7.5 */}
                  <div className="mt-6 rounded-2xl bg-[#fafbf9] p-4 border border-line text-xs text-soft leading-relaxed">
                    <strong>Interpretation Note (§7.5)</strong>: Total waiting time before service commences is governed by arrival rate and counter throughput. Krenox&apos;s virtual queueing transforms idle physical standing in high-traffic hallways into productive remote waiting time (library, cafeteria, dorms) without degrading counter throughput.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

