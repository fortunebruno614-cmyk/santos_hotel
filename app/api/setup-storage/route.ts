import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase.storage.createBucket("santos_hotel", {
    public: true,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
    fileSizeLimit: 5 * 1024 * 1024,
  });

  if (error && error.message !== "Bucket already exists") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    message: error?.message === "Bucket already exists" ? "Bucket already exists" : "Bucket created successfully",
    bucket: data,
  });
}
