import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://appufcbmkkwjrxwnpxbj.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwcHVmY2Jta2t3anJ4d25weGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1OTEyNjcsImV4cCI6MjExMDE2NzI2N30.Bqj8uUaC1ylxAb247mbDJCgAv2pW17kuD3Ma-ka9a5w";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
