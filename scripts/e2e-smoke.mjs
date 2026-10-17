// scripts/e2e-smoke.mjs - Full End-to-End Live System Smoke Test

async function runSmokeTest() {
  console.log("=== Running ErytnaBusana POS Live Smoke Test ===");
  const baseUrl = "http://localhost:3000";

  // 1. Test Login
  console.log("\n1. Testing Login API with Admin...");
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });
  const loginData = await loginRes.json();
  const setCookie = loginRes.headers.get("set-cookie");
  console.log("   Login Status:", loginRes.status);
  console.log("   User Name:", loginData.user?.name);
  console.log("   Role:", loginData.user?.role);
  if (!setCookie) throw new Error("No Set-Cookie header received from login");
  const cookie = setCookie.split(";")[0];

  const authHeaders = {
    "Content-Type": "application/json",
    Cookie: cookie,
  };

  // 2. Test /api/auth/me
  console.log("\n2. Testing /api/auth/me...");
  const meRes = await fetch(`${baseUrl}/api/auth/me`, { headers: authHeaders });
  const meData = await meRes.json();
  console.log("   Current session user:", meData.user?.name, `(${meData.user?.role})`);

  // 3. Test Products list
  console.log("\n3. Testing /api/products...");
  const prodRes = await fetch(`${baseUrl}/api/products`, { headers: authHeaders });
  const prodData = await prodRes.json();
  console.log("   Loaded products count:", prodData.products?.length);
  const benangAstra = prodData.products.find((p) => p.sku === "BNG-AST-01");
  const resleting = prodData.products.find((p) => p.sku === "RSL-YKK-07");
  console.log("   Found Benang Astra:", benangAstra?.name, "| Stock:", benangAstra?.inventory?.quantity);

  // 4. Test Checkout: Acceptance Test 1 & 3 (Retail 2 pcs, tender Rp 10.000)
  console.log("\n4. Testing POS Checkout (Retail 2 pcs Benang Astra @ Rp5.000)...");
  const checkout1Res = await fetch(`${baseUrl}/api/sales`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      customerName: "Pelanggan Eceran Smoke",
      items: [{ productId: benangAstra.id, quantity: 2 }],
      paymentMethod: "CASH",
      amountTendered: 10000,
      idempotencyKey: `SMOKE-T1-${Date.now()}`,
    }),
  });
  const checkout1Data = await checkout1Res.json();
  console.log("   Checkout Status:", checkout1Res.status);
  console.log("   Invoice Number:", checkout1Data.sale?.invoiceNumber);
  console.log("   Total Amount:", checkout1Data.sale?.totalAmount);
  console.log("   Subtotal Item 1:", checkout1Data.sale?.items[0]?.subtotal);
  console.log("   Tier Used:", checkout1Data.sale?.items[0]?.tierUsed);
  if (checkout1Data.sale?.totalAmount !== 10000) throw new Error("Expected 10.000 total");

  // 5. Test Checkout: Acceptance Test 2 (Wholesale 12 pcs Benang Astra @ Rp4.000)
  console.log("\n5. Testing POS Checkout (Wholesale 12 pcs Benang Astra @ Rp4.000)...");
  const checkout2Res = await fetch(`${baseUrl}/api/sales`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      customerName: "Konveksi Mitra Smoke",
      items: [{ productId: benangAstra.id, quantity: 12 }],
      paymentMethod: "CASH",
      amountTendered: 50000,
      idempotencyKey: `SMOKE-T2-${Date.now()}`,
    }),
  });
  const checkout2Data = await checkout2Res.json();
  console.log("   Checkout Status:", checkout2Res.status);
  console.log("   Invoice Number:", checkout2Data.sale?.invoiceNumber);
  console.log("   Total Amount:", checkout2Data.sale?.totalAmount);
  console.log("   Price per unit:", checkout2Data.sale?.items[0]?.unitPrice);
  console.log("   Tier Used:", checkout2Data.sale?.items[0]?.tierUsed);
  console.log("   Change Amount:", checkout2Data.sale?.payments[0]?.changeAmount);
  if (checkout2Data.sale?.totalAmount !== 48000) throw new Error("Expected 48.000 total");
  if (checkout2Data.sale?.payments[0]?.changeAmount !== 2000) throw new Error("Expected 2.000 change");

  // 6. Test Checkout: Acceptance Test 4 (Insufficient stock rejection)
  console.log("\n6. Testing POS Checkout (Insufficient stock rejection)...");
  const checkout4Res = await fetch(`${baseUrl}/api/sales`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      items: [{ productId: resleting.id, quantity: 999 }],
      paymentMethod: "CASH",
      amountTendered: 1000000,
      idempotencyKey: `SMOKE-T4-${Date.now()}`,
    }),
  });
  const checkout4Data = await checkout4Res.json();
  console.log("   Expected Error received:", checkout4Data.error);
  if (checkout4Res.status !== 400) throw new Error("Expected 400 rejection for out of stock");

  // 7. Test Void Sale (Acceptance Test 6)
  console.log("\n7. Testing Void Sale for Invoice", checkout1Data.sale?.invoiceNumber);
  const voidRes = await fetch(`${baseUrl}/api/sales/${checkout1Data.sale.id}/void`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ reason: "Uji coba pembatalan transaksi smoke test" }),
  });
  const voidData = await voidRes.json();
  console.log("   Void Status:", voidRes.status);
  console.log("   Sale Status:", voidData.sale?.status);
  console.log("   Cancel Reason:", voidData.sale?.cancelReason);
  if (voidData.sale?.status !== "CANCELLED") throw new Error("Expected CANCELLED status");

  // 8. Test Dashboard Metrics
  console.log("\n8. Testing Dashboard API...");
  const dashRes = await fetch(`${baseUrl}/api/reports/dashboard`, { headers: authHeaders });
  const dashData = await dashRes.json();
  console.log("   Revenue Today:", dashData.summary?.revenueToday);
  console.log("   Gross Profit Today:", dashData.summary?.grossProfitToday);
  console.log("   Transactions Count:", dashData.summary?.transactionsToday);
  console.log("   Top Products Count:", dashData.topProducts?.length);

  // 9. Test Sales Report
  console.log("\n9. Testing Sales Report API...");
  const repRes = await fetch(`${baseUrl}/api/reports/sales`, { headers: authHeaders });
  const repData = await repRes.json();
  console.log("   Total Gross Sales:", repData.summary?.grossSales);
  console.log("   Total Net Sales:", repData.summary?.netSales);
  console.log("   Total COGS:", repData.summary?.totalCogs);
  console.log("   Estimated Gross Profit:", repData.summary?.grossProfit);
  console.log("   Total Valid Transactions:", repData.summary?.totalTransactions);
  console.log("   Total Cancelled Transactions:", repData.summary?.cancelledTransactions);

  console.log("\n=======================================================");
  console.log(" ALL LIVE E2E SMOKE TESTS PASSED PERFECTLY (100% OK)!");
  console.log("=======================================================\n");
}

runSmokeTest().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
