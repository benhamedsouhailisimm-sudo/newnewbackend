// testSupabase.js
import { createClient } from '@supabase/supabase-js';

// 🔹 عدّل فقط هذين السطرين
const SUPABASE_URL = 'https://wocjtjzilxnjmcixapsy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvY2p0anppbHhuam1jaXhhcHN5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjA0OTQyMywiZXhwIjoyMDgxNjI1NDIzfQ.bzhaITBwnMPcgzeHdSL0_Cx5sjO72mx4TDCpyt7ixXM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  console.log('🚀 Testing Supabase connection...');

  const { data, error } = await supabase
    .from('members')   // اسم جدول موجود عندك
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ ERROR:', error);
  } else {
    console.log('✅ SUCCESS! Data:', data);
  }
}

test();
