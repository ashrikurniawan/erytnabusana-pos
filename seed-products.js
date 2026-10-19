import { supabase } from './supabaseClient.js'

// Data awal produk toko alat jahit ErytnaBusana
const initialProducts = [
  {
    sku: 'BNG-AST-01',
    name: 'Benang Jahit Astra 500y',
    category: 'Benang Jahit',
    buy_price: 2500,
    sell_price: 5000,
    stock: 43,
    min_stock: 10
  },
  {
    sku: 'JRM-ORG-14',
    name: 'Jarum Jahit Organ Needles DBx1 No 14',
    category: 'Jarum Jahit',
    buy_price: 15000,
    sell_price: 22000,
    stock: 24,
    min_stock: 5
  },
  {
    sku: 'KAN-TYB-01',
    name: 'Kain Katun Toyobo Fodu Jepang - Navy',
    category: 'Kain',
    buy_price: 24000,
    sell_price: 35000,
    stock: 39,
    min_stock: 10
  },
  {
    sku: 'KNC-KMG-18L',
    name: 'Kancing Kemeja 4 Lubang Putih 18L',
    category: 'Kancing Baju',
    buy_price: 3000,
    sell_price: 6000,
    stock: 79,
    min_stock: 15
  },
  {
    sku: 'RSL-YKK-07',
    name: 'Resleting YKK 7 inch Celana Hitam',
    category: 'Resleting',
    buy_price: 2500,
    sell_price: 4500,
    stock: 4,
    min_stock: 5
  }
]

async function seedProducts() {
  console.log('Memulai proses memasukkan data produk awal ke Supabase...')

  const { data, error } = await supabase
    .from('products')
    .insert(initialProducts)
    .select()

  if (error) {
    console.error('Gagal memasukkan data produk:', error.message)
  } else {
    console.log('Berhasil! Data produk berikut telah dimasukkan:')
    console.table(data)
  }
}

seedProducts()