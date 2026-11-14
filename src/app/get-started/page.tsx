"use client";

import { FormEvent, useEffect, useState } from "react";

type Plan = {
  plan_name: string;
  base_fee: number;
  included_seats: number;
  extra_seat_rate: number;
  description: string;
};

type Trial = {
  plan: string;
  days: number;
  seats: number;
};

type Registration = {
  company_code: string;
  client_domain: string;
  status: string;
  plan: string;
  billing_cycle: string;
  seat_limit: number;
  valid_until?: string;
  subscription_id?: string;
  key_id?: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const DEFAULT_TRIAL: Trial = { plan: "Professional", days: 14, seats: 10 };

export default function GetStartedPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [trial, setTrial] = useState<Trial>(DEFAULT_TRIAL);
  const [planName, setPlanName] = useState(DEFAULT_TRIAL.plan);
  const [billing, setBilling] = useState<"monthly" | "annual" | "trial">("monthly");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Registration | null>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    document.body.appendChild(script);
    fetch("/api/plans")
      .then((response) => response.json())
      .then((data) => {
        const nextTrial = data?.trial?.plan ? data.trial : DEFAULT_TRIAL;
        setTrial(nextTrial);
        if (data?.plans?.length) {
          setPlans(data.plans);
          const preferred = data.plans.some(
            (plan: Plan) => plan.plan_name === nextTrial.plan
          )
            ? nextTrial.plan
            : data.plans[0].plan_name;
          setPlanName(preferred);
        } else if (data?.error) {
          setError(data.error);
        }
      })
      .catch(() => setError("Could not load plans."));
  }, []);

  const selected = plans.find((plan) => plan.plan_name === planName);

  function annualRupees(fee: number) {
    return Math.round(fee * 12 * 0.8);
  }

  function priceLabel(plan: Plan) {
    if (billing === "trial") {
      return `${trial.days} days free · ${trial.seats} employees`;
    }
    if (billing === "annual") return `₹${annualRupees(plan.base_fee).toLocaleString("en-IN")} / year`;
    return `₹${plan.base_fee.toLocaleString("en-IN")} / month`;
  }

  function chooseBilling(option: "monthly" | "annual" | "trial") {
    setBilling(option);
    if (option === "trial") setPlanName(trial.plan);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          email,
          phone,
          plan_name: billing === "trial" ? trial.plan : planName,
          billing,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setError(data.error || "Registration could not start.");
        return;
      }
      if (data.billing_cycle === "trial" || data.status === "Active") {
        setResult(data);
        return;
      }
      await openCheckout(data);
    } catch {
      setError("Registration could not start.");
    } finally {
      setLoading(false);
    }
  }

  function openCheckout(data: Registration) {
    return new Promise<void>((resolve) => {
      if (!window.Razorpay || !data.key_id || !data.subscription_id) {
        setError("Payment checkout is unavailable.");
        resolve();
        return;
      }
      const checkout = new window.Razorpay({
        key: data.key_id,
        subscription_id: data.subscription_id,
        name: "Vision",
        description: `${data.plan} ${data.billing_cycle}`,
        prefill: { email, contact: phone },
        theme: { color: "#0891b2" },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_subscription_id: string;
          razorpay_signature: string;
        }) => {
          const confirmed = await fetch("/api/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              company_code: data.company_code,
              ...response,
            }),
          });
          const confirmedData = await confirmed.json();
          if (!confirmed.ok || confirmedData.error) {
            setError(confirmedData.error || "Payment could not be confirmed.");
          } else {
            setResult(confirmedData);
          }
          resolve();
        },
        modal: { ondismiss: () => resolve() },
      });
      checkout.open();
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <a href="/" className="text-xl font-extrabold tracking-tight">Vision</a>
          <div className="flex items-center gap-5">
            <a href="/account" className="text-sm font-semibold text-slate-600">Account</a>
            <a href="/#download" className="text-sm font-semibold text-cyan-700">Get the app</a>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight">Start your company workspace</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Pick a plan. Face and GPS come with Professional. There is no setup fee. After payment, employees type the company code in the Vision app.
        </p>

        {result ? (
          <div className="mt-8 rounded-2xl border border-cyan-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">Company code</p>
            <p className="mt-2 text-4xl font-extrabold">{result.company_code}</p>
            <p className="mt-4 text-slate-600">
              {result.status === "Active"
                ? "Employees type this company code in the Vision app. The workspace address is reserved; Octavision finishes the company site before daily HR work starts there."
                : "Payment is still pending. The company code starts working in the app after Razorpay confirms it."}
            </p>
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">Plan</dt><dd className="font-semibold">{result.plan} · {result.billing_cycle}</dd></div>
              <div><dt className="text-slate-500">Seats</dt><dd className="font-semibold">{result.seat_limit}</dd></div>
              <div><dt className="text-slate-500">Valid until</dt><dd className="font-semibold">{result.valid_until || "After payment"}</dd></div>
              <div><dt className="text-slate-500">Workspace</dt><dd className="font-semibold break-all">{result.client_domain}</dd></div>
            </dl>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(["monthly", "annual", "trial"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => chooseBilling(option)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${billing === option ? "bg-cyan-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
                  >
                    {option === "monthly" ? "Monthly" : option === "annual" ? "Annual · 20% off" : `${trial.days}-day pilot`}
                  </button>
                ))}
              </div>
              <div className="grid gap-3">
                {plans.map((plan) => (
                  <button
                    key={plan.plan_name}
                    type="button"
                    disabled={billing === "trial" && plan.plan_name !== trial.plan}
                    onClick={() => setPlanName(plan.plan_name)}
                    className={`rounded-2xl border p-5 text-left ${planName === plan.plan_name ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-white"} disabled:opacity-40`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-lg font-bold">
                        {plan.plan_name}
                        {plan.plan_name === "Professional" && (
                          <span className="ml-2 rounded-full bg-cyan-600 px-2 py-0.5 text-xs font-semibold text-white">Most popular</span>
                        )}
                      </span>
                      <span className="font-semibold text-cyan-800">{priceLabel(plan)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
                    <p className="mt-2 text-sm text-slate-500">{plan.included_seats} employees included · ₹{plan.extra_seat_rate} per extra employee</p>
                  </button>
                ))}
              </div>
              {billing === "annual" && (
                <p className="text-sm text-slate-500">Annual billing is 20% off the year. That is the two-months-free offer, paid upfront. Setup fee is ₹0.</p>
              )}
              {billing === "trial" && (
                <p className="text-sm text-slate-500">The pilot is {trial.plan}, {trial.seats} employees, {trial.days} days, and no card. It includes face check-in so you can try the full daily flow.</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <label className="block text-sm font-semibold">Company name
                <input required value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="mt-4 block text-sm font-semibold">Admin email
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="mt-4 block text-sm font-semibold">Phone
                <input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              {selected && (
                <p className="mt-4 text-sm text-slate-600">
                  {billing === "trial" ? trial.plan : selected.plan_name}: {priceLabel(billing === "trial" ? (plans.find((plan) => plan.plan_name === trial.plan) || selected) : selected)}
                </p>
              )}
              {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}
              <button disabled={loading || !plans.length} className="mt-6 w-full rounded-lg bg-cyan-600 px-4 py-3 font-bold text-white disabled:opacity-50">
                {loading ? "Please wait..." : billing === "trial" ? "Start free pilot" : "Continue to payment"}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
