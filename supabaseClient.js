import { createClient } from '@supabase/supabase-js'

// Ganti nilai di bawah ini dengan Project URL dan anon key Anda dari Supabase Dashboard
const supabaseUrl = 'https://gqxnfsxchaongjvuqvdd.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpZG5xZ3B5dmFibnBhaHpkYmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNDA5MTIsImV4cCI6MjEwNzgxNjkxMn0.KFFoFqioTWGEUPyOk7irAlK1hp0XBiSOU8VbEfwWdtE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)