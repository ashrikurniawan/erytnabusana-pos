import { supabase } from './supabaseClient.js'

const initialCustomers = [
  { name: 'Ibu Rina (Penjahit Langganan)', phone: '081234567890' },
  { name: 'Konveksi Berkah Mandiri', phone: '085678901234' },
  { name: 'Bapak Budi (Tailor)', phone: '081898989898' }
]

async function seedCustomers() {
  console.log('Memasukkan data pelanggan awal ke Supabase...')

  const { data, error } = await supabase
    .from('customers')
    .insert(initialCustomers)
    .select()

  if (error) {
    console.error('Gagal memasukkan data pelanggan:', error.message)
  } else {
    console.log('Berhasil! Data pelanggan berikut telah ditambahkan:')
    console.table(data)
  }
}

seedCustomers()