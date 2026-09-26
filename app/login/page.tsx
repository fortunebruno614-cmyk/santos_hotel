import Link from "next/link";
import { login } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="authPage">
      <div className="authCard">
        <h1>Welcome back</h1>
        <p className="subtitle">Log in to Santos Hotel to manage your stay.</p>

        {params.error && <div className="authError">{params.error}</div>}

        <form action={login}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>

          <button className="btn btnPrimary" type="submit" style={{ width: "100%" }}>
            Log in
          </button>
        </form>

        <p className="authSwitch">
          New to Santos Hotel? <Link href="/register">Create an account</Link>
        </p>

        <p className="authLink">
          <Link href="/">← Back to home</Link>
        </p>
      </div>
    </main>
  );
}