"use client";

import { FormEvent, useEffect, useState } from "react";

type Plan = {
  plan_name: string;
  base_fee: number;
  included_seats: number;
  description: string;
};

type Account = {
  client_name?: string;
  company_code: string;
  client_domain: string;
  status: string;
  plan: string;
  billing_cycle: string;
  seat_limit: number;
  valid_until?: string;
  token?: string;
  subscription_id?: string;
  key_id?: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const TOKEN_KEY = "vision-account-token";

export default function AccountPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [companyCode, setCompanyCode] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [notice, setNotice] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [planName, setPlanName] = useState("Professional");
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    document.body.appendChild(script);
    fetch("/api/plans")
      .then((response) => response.json())
      .then((data) => {
        if (data?.plans?.length) setPlans(data.plans);
      })
      .catch(() => setError("Could not load plans."));
    const token = window.sessionStorage.getItem(TOKEN_KEY);
    if (token) loadAccount(token);
  }, []);

  async function loadAccount(token: string) {
    const response = await fetch("/api/account/details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      window.sessionStorage.removeItem(TOKEN_KEY);
      setAccount(null);
      return;
    }
    setAccount({ ...data, token });
    if (data.plan) setPlanName(data.plan);
    if (data.billing_cycle === "monthly" || data.billing_cycle === "annual") {
      setBilling(data.billing_cycle);
    }
  }

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/account/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_code: companyCode, email }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setError(data.error || "The sign-in code could not be sent.");
        return;
      }
      setCodeSent(true);
      setNotice(
        data.already_sent
          ? "Use the code already sent to this email. A new code is available after one minute."
          : "Enter the code from your email. It expires in 10 minutes."
      );
    } catch {
      setError("The sign-in code could not be sent.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/account/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_code: companyCode, email, code: otp }),
      });
      const data = await response.json();
      if (!response.ok || data.error || !data.token) {
        setError(data.error || "That code is not valid.");
        return;
      }
      window.sessionStorage.setItem(TOKEN_KEY, data.token);
      setAccount(data);
      if (data.plan) setPlanName(data.plan);
      if (data.billing_cycle === "monthly" || data.billing_cycle === "annual") {
        setBilling(data.billing_cycle);
      }
    } catch {
      setError("That code is not valid.");
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    window.sessionStorage.removeItem(TOKEN_KEY);
    setAccount(null);
    setCodeSent(false);
    setOtp("");
  }

  function annualRupees(fee: number) {
    return Math.round(fee * 12 * 0.8);
  }

  function priceLabel(plan: Plan) {
    if (billing === "annual") {
      return `₹${annualRupees(plan.base_fee).toLocaleString("en-IN")} / year`;
    }
    return `₹${plan.base_fee.toLocaleString("en-IN")} / month`;
  }

  async function changePlan() {
    if (!account?.token) return;
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/account/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: account.token,
          plan_name: planName,
          billing,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setError(data.error || "The plan change could not start.");
        setLoading(false);
        return;
      }
      await openCheckout(data);
    } catch {
      setError("The plan change could not start.");
    } finally {
      setLoading(false);
    }
  }

  function openCheckout(data: Account) {
    return new Promise<void>((resolve) => {
      if (!window.Razorpay || !data.key_id || !data.subscription_id || !account?.token) {
        setError("Payment checkout is unavailable.");
        resolve();
        return;
      }
      const token = account.token;
      const checkout = new window.Razorpay({
        key: data.key_id,
        subscription_id: data.subscription_id,
        name: "Vision",
        description: `${data.plan} ${data.billing_cycle}`,
        prefill: { email },
        theme: { color: "#0891b2" },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_subscription_id: string;
          razorpay_signature: string;
        }) => {
          const confirmed = await fetch("/api/account/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, ...response }),
          });
          const confirmedData = await confirmed.json();
          if (!confirmed.ok || confirmedData.error) {
            setError(confirmedData.error || "Payment could not be confirmed.");
          } else {
            setAccount({ ...confirmedData, token });
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
          <a href="/get-started" className="text-sm font-semibold text-cyan-700">Get started</a>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight">Your company account</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          {account
            ? "Review this workspace, or choose another plan. The company code stays the same."
            : "Enter the company code and the admin email used at registration. We email a code, then you can see the plan and change it without creating another company."}
        </p>

        {account ? (
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">Company code</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight">{account.company_code}</p>
              <p className="mt-1 text-slate-600">{account.client_name}</p>
              <dl className="mt-6 border-t border-slate-100 text-sm">
                {[
                  ["Plan", `${account.plan} · ${account.billing_cycle}`],
                  ["Status", account.status],
                  ["Seats", String(account.seat_limit)],
                  ["Valid until", account.valid_until || "—"],
                  ["Workspace", account.client_domain],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-3 border-b border-slate-100 py-3">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className={`font-semibold ${label === "Workspace" ? "break-all" : ""}`}>{value}</dd>
                  </div>
                ))}
              </dl>
              <button type="button" onClick={signOut} className="mt-6 text-left text-sm font-semibold text-slate-500">
                Sign out
              </button>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">Plans</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight">Choose a plan</p>
              <p className="mt-1 text-slate-600">Payment confirms the change. The company code stays the same.</p>
              <div className="mt-6 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                {(["monthly", "annual"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setBilling(option)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold ${billing === option ? "bg-cyan-600 text-white" : "text-slate-600"}`}
                  >
                    {option === "monthly" ? "Monthly" : "Annual · 20% off"}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-3">
                {plans.map((plan) => {
                  const current = plan.plan_name === account.plan && billing === account.billing_cycle;
                  return (
                    <button
                      key={plan.plan_name}
                      type="button"
                      onClick={() => setPlanName(plan.plan_name)}
                      className={`w-full rounded-xl border p-4 text-left ${planName === plan.plan_name ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-white"}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-lg font-bold">
                          {plan.plan_name}
                          {current && (
                            <span className="ml-2 align-middle rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">Current</span>
                          )}
                        </span>
                        <span className="shrink-0 text-right font-semibold text-cyan-800">{priceLabel(plan)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{plan.description}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-5">
                {error && <p className="mb-4 text-sm font-medium text-red-600">{error}</p>}
                <button
                  type="button"
                  disabled={loading || !plans.length || (planName === account.plan && billing === account.billing_cycle)}
                  onClick={changePlan}
                  className="w-full rounded-lg bg-cyan-600 px-4 py-3 font-bold text-white disabled:opacity-50"
                >
                  {loading ? "Please wait..." : planName === account.plan && billing === account.billing_cycle ? "Current plan" : "Change plan"}
                </button>
              </div>
            </section>
          </div>
        ) : (
          <form onSubmit={codeSent ? verifyCode : sendCode} className="mt-8 max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="block text-sm font-semibold">Company code
              <input required value={companyCode} onChange={(event) => setCompanyCode(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="mt-4 block text-sm font-semibold">Admin email
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
            </label>
            {codeSent && (
              <label className="mt-4 block text-sm font-semibold">Email code
                <input required inputMode="numeric" value={otp} onChange={(event) => setOtp(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal tracking-widest" />
              </label>
            )}
            {notice && <p className="mt-4 text-sm text-slate-600">{notice}</p>}
            {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}
            <button disabled={loading} className="mt-6 w-full rounded-lg bg-cyan-600 px-4 py-3 font-bold text-white disabled:opacity-50">
              {loading ? "Please wait..." : codeSent ? "Open account" : "Email me a code"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
