import { supabase } from './supabaseClient.js'

async function simulateCheckout() {
  console.log('Memulai simulasi transaksi kasir...')

  // 1. Data ringkasan transaksi (Nota baru)
  const invoiceData = {
    invoice_number: 'INV-' + Date.now(), // Nomor nota unik berdasarkan waktu
    total_amount: 14000,                 // Total belanja pelanggan
    gross_profit: 6500,                  // Total perkiraan laba kotor
    payment_method: 'Tunai'
  }

  // Masukkan ke tabel transactions
  const { data: trxData, error: trxError } = await supabase
    .from('transactions')
    .insert([invoiceData])
    .select()

  if (trxError) {
    console.error('Gagal membuat transaksi:', trxError.message)
    return
  }

  const transactionId = trxData[0].id
  console.log(`Transaksi berhasil dibuat dengan ID: ${transactionId}`)

  // 2. Data barang yang dibeli dalam transaksi ini (Item Detail)
  // Misal: Membeli 2 pcs Benang Jahit Astra (ID produk: 1)
  const itemsData = [
    {
      transaction_id: transactionId,
      product_id: 1, // Pastikan ID produk sesuai dengan isi tabel products Anda
      quantity: 2,
      price: 5000
    }
  ]

  const { error: itemsError } = await supabase
    .from('transaction_items')
    .insert(itemsData)

  if (itemsError) {
    console.error('Gagal menyimpan detail item:', itemsError.message)
  } else {
    console.log('Berhasil! Detail item transaksi dan nota telah tersimpan ke Supabase.')
  }
}

simulateCheckout()