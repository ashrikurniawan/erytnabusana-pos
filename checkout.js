import { supabase } from './supabaseClient.js'

async function processCheckout(cartItems, paymentMethod = 'Tunai') {
  console.log('Memproses transaksi kasir dan pengurangan stok...')

  // 1. Hitung total dan laba kotor dari keranjang belanja
  let totalAmount = 0
  let grossProfit = 0

  cartItems.forEach(item => {
    totalAmount += item.sell_price * item.quantity
    grossProfit += (item.sell_price - item.buy_price) * item.quantity
  })

  // 2. Buat nomor nota unik
  const invoiceNumber = 'INV-' + Date.now()

  // 3. Masukkan ke tabel transactions
  const { data: trxData, error: trxError } = await supabase
    .from('transactions')
    .insert([{
      invoice_number: invoiceNumber,
      total_amount: totalAmount,
      gross_profit: grossProfit,
      payment_method: paymentMethod
    }])
    .select()

  if (trxError) {
    console.error('Gagal membuat transaksi:', trxError.message)
    return
  }

  const transactionId = trxData[0].id

  // 4. Masukkan item detail ke transaction_items & Kurangi Stok Produk
  for (const item of cartItems) {
    // A. Simpan item transaksi
    const { error: itemError } = await supabase
      .from('transaction_items')
      .insert([{
        transaction_id: transactionId,
        product_id: item.id,
        quantity: item.quantity,
        price: item.sell_price
      }])

    if (itemError) {
      console.error(`Gagal menyimpan item ${item.name}:`, itemError.message)
      continue
    }

    // B. Ambil stok saat ini terlebih dahulu
    const { data: prodData, error: fetchError } = await supabase
      .from('products')
      .select('stock')
      .eq('id', item.id)
      .single()

    if (!fetchError && prodData) {
      const newStock = prodData.stock - item.quantity

      // C. Update stok produk di tabel products
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', item.id)

      if (updateError) {
        console.error(`Gagal memperbarui stok untuk produk ID ${item.id}:`, updateError.message)
      } else {
        console.log(`Stok produk ID ${item.id} berhasil dikurangi. Sisa stok: ${newStock}`)
      }
    }
  }

  console.log(`Checkout selesai! Nota: ${invoiceNumber}`)
}

// SIMULASI KERANJANG BELANJA:
// Misal pelanggan membeli 2 pcs Benang Jahit Astra (ID: 1, Harga Beli: 2500, Harga Jual: 5000)
const sampleCart = [
  {
    id: 1,
    name: 'Benang Jahit Astra 500y',
    buy_price: 2500,
    sell_price: 5000,
    quantity: 2
  }
]

// Jalankan simulasi checkout
processCheckout(sampleCart, 'Tunai')