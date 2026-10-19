import { supabase } from './supabaseClient.js'

async function testConnection() {
  const { data, error } = await supabase.from('products').select('*')
  
  if (error) {
    console.error('Koneksi Gagal:', error.message)
  } else {
    console.log('Koneksi Berhasil! Data produk:', data)
  }
}

testConnection()