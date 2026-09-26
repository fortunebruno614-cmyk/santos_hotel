import Link from "next/link";
import { register } from "../actions";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="authPage">
      <div className="authCard">
        <h1>Create your account</h1>
        <p className="subtitle">
          Join Santos Hotel to book rooms, save offers, and earn rewards.
        </p>

        {params.error && <div className="authError">{params.error}</div>}

        <form action={register}>
          <div className="field">
            <label htmlFor="fullName">Full name</label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              placeholder="Jane Santos"
              required
            />
          </div>

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
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </div>

          <button className="btn btnPrimary" type="submit" style={{ width: "100%" }}>
            Create account
          </button>
        </form>

        <p className="authSwitch">
          Already have an account? <Link href="/login">Log in</Link>
        </p>

        <p className="authLink">
          <Link href="/">← Back to home</Link>
        </p>
      </div>
    </main>
  );
}