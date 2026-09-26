import Link from "next/link";
import { getProfile, signOut } from "@/app/actions";
import { redirect } from "next/navigation";
import ProfileForm from "./profile-form";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getProfile();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : null;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <>
      <nav className="nav">
        <Link className="brand" href="/dashboard">
          Santos<span> Hotel</span>
        </Link>
        <div className="navActions">
          <Link className="btn" href="/dashboard">Dashboard</Link>
          <form action={signOut} style={{ display: "inline" }}>
            <button type="submit" className="btn btnLogout">Log out</button>
          </form>
        </div>
      </nav>

      <main style={{ padding: "60px 40px", maxWidth: 800, margin: "0 auto", width: "100%" }}>
        <Link href="/dashboard" className="backLink">
          ← Back to Dashboard
        </Link>

        <h1 style={{ fontSize: 32, marginBottom: 8 }}>My Profile</h1>
        <p style={{ color: "var(--muted)", marginBottom: 40, fontSize: 16 }}>
          Manage your personal information and account settings.
        </p>

        {message && <div className="message" style={{ marginBottom: 24 }}>{message}</div>}
        {error && <div className="authError">{error}</div>}

        <ProfileForm
          fullName={user.user_metadata?.full_name ?? ""}
          email={user.email ?? ""}
          phone={user.user_metadata?.phone ?? ""}
          avatarUrl={user.user_metadata?.avatar_url ?? ""}
        />
      </main>

      <footer className="footer">
        © {new Date().getFullYear()} Santos Hotel. All rights reserved.
      </footer>
    </>
  );
}
