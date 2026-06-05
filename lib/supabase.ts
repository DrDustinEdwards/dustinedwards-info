import { createClient } from "@supabase/supabase-js";

// Supabase client. Wired up but not yet used by any page — it's here for when
// you add the login area, lab data, or dynamic content. Values come from
// .env.local (see .env.local.example).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  url && anonKey ? createClient(url, anonKey) : null;

// Usage example (client component):
//   import { supabase } from "@/lib/supabase";
//   const { data } = await supabase!.from("table").select();
