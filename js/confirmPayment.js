console.log("🧾 confirmPayment.js loaded");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBMJX0eWB1gUyvBUzeUSYt05XX-lD33-js",
  authDomain: "sejalan-884bc.firebaseapp.com",
  projectId: "sejalan-884bc",
  storageBucket: "sejalan-884bc.firebasestorage.app",
  messagingSenderId: "768730225727",
  appId: "1:768730225727:web:fbb9dcef53b8ea1f0a2c8a",
  measurementId: "G-E522147QHB"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;
let paymentCompleted = false; // Track if payment was completed
let authReady = false;

// === DELETE PURCHASED ITEMS FROM CART ===
async function deletePurchasedItemsFromCart() {
  const itemIds = JSON.parse(localStorage.getItem("cartItemsToDelete") || "[]");
  if (itemIds.length === 0 || !currentUser) {
    console.log("🛒 No items to delete from cart");
    return;
  }
  
  console.log("🗑️ Deleting purchased items from cart:", itemIds);
  
  for (const id of itemIds) {
    try {
      const cartItemRef = doc(db, `users/${currentUser.uid}/cart/${id}`);
      await deleteDoc(cartItemRef);
      console.log("✅ Deleted from cart:", id);
    } catch (err) {
      console.error("❌ Failed to delete from cart:", id, err);
    }
  }
  
  // Clear the list
  localStorage.removeItem("cartItemsToDelete");
  console.log("🛒 Cart cleanup complete");
}

// === GOOGLE SPREADSHEET INTEGRATION ===
let sheetWebAppUrl = null;

async function getSheetConfig() {
  try {
    const sheetDoc = await getDoc(doc(db, "sheet", "sheet1"));
    if (sheetDoc.exists()) {
      const data = sheetDoc.data();
      sheetWebAppUrl = data.url;
      console.log("📊 Sheet URL loaded:", sheetWebAppUrl ? "✅" : "❌ Not found");
      return data;
    } else {
      console.warn("⚠️ Sheet configuration not found in /sheet/sheet1");
      return null;
    }
  } catch (err) {
    console.error("❌ Failed to load sheet config:", err);
    return null;
  }
}

// Save order to Google Spreadsheet
async function saveToSpreadsheet(orderId, orderData, action = "create") {
  if (!sheetWebAppUrl) {
    await getSheetConfig();
  }
  
  if (!sheetWebAppUrl) {
    console.warn("⚠️ No spreadsheet URL configured, skipping sheet save");
    return false;
  }
  
  try {
    // Get customer info
    const customerInfo = orderData.customerInfo || pending?.customerInfo || {};
    const items = orderData.items || [];
    
    console.log("📊 Sending to spreadsheet:", action, orderId, "items:", items.length);
    
    // Send each item as a separate row
    // OPTIMIZATION: Only include proof images in the first item to speed up upload
    const itemsData = items.map((item, index) => ({
      action: action,
      orderId: orderId,
      userId: orderData.userId || currentUser?.uid || "",
      userEmail: orderData.userEmail || currentUser?.email || "",
      // Individual item data
      itemName: item.title || item.name || "Unknown Item",
      itemType: (item.type || "unknown").toLowerCase(),
      itemQty: Number(item.qty) || 1,
      itemPrice: Number(item.price) || 0,
      itemSubtotal: (Number(item.price) || 0) * (Number(item.qty) || 1),
      // Order totals
      orderTotal: orderData.total || 0,
      paymentMethod: orderData.paymentMethod || "",
      shippingMethod: orderData.shippingMethod || "",
      shippingCost: orderData.shippingCost || 0,
      status: orderData.status || "pending_verification",
      orderDate: orderData.orderDate || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Only include proof image in FIRST item to avoid duplicate uploads
      proofImage: index === 0 ? (orderData.proofImage || null) : null,
      // Customer information
      namaLengkap: customerInfo.namaLengkap || "",
      nomorHP: customerInfo.nomorHP || "",
      universitas: customerInfo.universitas || "",
      angkatan: customerInfo.angkatan || "",
      alamatLengkap: customerInfo.alamatLengkap || "",
      kodePos: customerInfo.kodePos || "",
      instagramAccount: customerInfo.instagramAccount || "",
      // Additional fields for discount & name tags
      // Use item-specific nameTags if available, otherwise fall back to customerInfo
      nameTags: item.nameTags || "",
      hasDiscount: customerInfo.hasDiscount || false,
      // Only include Instagram proof in FIRST item
      instagramProof: index === 0 ? (customerInfo.instagramProof || null) : null
    }));
    
    // Send all items to spreadsheet - FIRE AND FORGET (non-blocking)
    fetch(sheetWebAppUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: itemsData })
    }).then(() => {
      console.log("📊 Spreadsheet save completed -", items.length, "items");
    }).catch(err => {
      console.warn("⚠️ Spreadsheet save failed (non-blocking):", err.message);
    });
    
    // Return immediately without waiting
    console.log("📊 Spreadsheet save started (fire-and-forget) -", items.length, "items");
    return true;
  } catch (err) {
    console.error("❌ Failed to prepare spreadsheet data:", err);
    return false;
  }
}

// Update order status in spreadsheet
async function updateSpreadsheetStatus(orderId, newStatus) {
  return saveToSpreadsheet(orderId, { status: newStatus }, "update");
}

// Initialize sheet config on load
getSheetConfig();

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  authReady = true;
  
  // Save order immediately on page entry (after auth is ready)
  if (user && pending && !resumingOrderId) {
    await saveOrderOnEntry();
  }
});

const container = document.getElementById("paymentDetails");
const params = new URLSearchParams(window.location.search);
const method = params.get("method");

// Ambil data dari localStorage
const pending = JSON.parse(localStorage.getItem("pendingPayment") || "null");
const resumingOrderId = localStorage.getItem("resumingOrderId"); // Check if resuming existing order

console.log("method:", method);
console.log("pendingPayment:", pending);
console.log("resumingOrderId:", resumingOrderId);

// === PAYMENT TIMER (1 HOUR) ===
const PAYMENT_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour in milliseconds
let timerInterval = null;

function initPaymentTimer() {
  let paymentStartTime = localStorage.getItem("paymentStartTime");
  
  // Only reuse existing timer if we're resuming an existing order
  // For new purchases, always start a fresh timer
  if (!resumingOrderId) {
    // New purchase - start fresh timer
    paymentStartTime = Date.now().toString();
    localStorage.setItem("paymentStartTime", paymentStartTime);
    console.log("⏱️ New payment timer started:", new Date(parseInt(paymentStartTime)));
  } else if (!paymentStartTime) {
    // Resuming but no timer found (shouldn't happen, but fallback)
    paymentStartTime = Date.now().toString();
    localStorage.setItem("paymentStartTime", paymentStartTime);
    console.log("⏱️ Fallback timer started for resuming order");
  } else {
    console.log("⏱️ Continuing existing timer from:", new Date(parseInt(paymentStartTime)));
  }
  
  const startTime = parseInt(paymentStartTime);
  const deadline = startTime + PAYMENT_TIMEOUT_MS;
  
  // Check if already expired
  if (Date.now() >= deadline) {
    handleTimerExpired();
    return false;
  }
  
  // Create timer display element
  createTimerDisplay();
  
  // Start countdown
  timerInterval = setInterval(() => {
    const remaining = deadline - Date.now();
    
    if (remaining <= 0) {
      clearInterval(timerInterval);
      handleTimerExpired();
    } else {
      updateTimerDisplay(remaining);
    }
  }, 1000);
  
  // Initial display
  updateTimerDisplay(deadline - Date.now());
  
  return true;
}

function createTimerDisplay() {
  // Create notification bar above the container
  const confirmPaymentContainer = document.querySelector(".confirm-payment");
  if (!confirmPaymentContainer) return;
  
  const timerBar = document.createElement("div");
  timerBar.id = "paymentTimer";
  timerBar.style.cssText = `
    background: linear-gradient(90deg, #fef3c7 0%, #fde68a 100%);
    border: 1px solid #f59e0b;
    border-radius: 8px;
    padding: 10px 16px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: 'Poppins', sans-serif;
    font-size: 14px;
    color: #92400e;
  `;
  timerBar.innerHTML = `
    <span>⏱️ Selesaikan pembayaran dalam waktu:</span>
    <span id="timerDisplay" style="font-weight:700;font-family:monospace;font-size:16px;color:#b45309;"></span>
  `;
  
  // Insert before the container content
  confirmPaymentContainer.insertBefore(timerBar, confirmPaymentContainer.querySelector("h2"));
}

function updateTimerDisplay(remainingMs) {
  const timerDisplay = document.getElementById("timerDisplay");
  const timerBar = document.getElementById("paymentTimer");
  if (!timerDisplay || !timerBar) return;
  
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  timerDisplay.textContent = timeStr;
  
  // Change style when less than 5 minutes (urgent)
  if (remainingMs < 5 * 60 * 1000) {
    timerBar.style.background = "linear-gradient(90deg, #fee2e2 0%, #fecaca 100%)";
    timerBar.style.borderColor = "#ef4444";
    timerBar.style.color = "#991b1b";
    timerDisplay.style.color = "#dc2626";
  } else if (remainingMs < 15 * 60 * 1000) {
    // Warning state
    timerBar.style.background = "linear-gradient(90deg, #fef3c7 0%, #fed7aa 100%)";
    timerBar.style.borderColor = "#f97316";
    timerDisplay.style.color = "#ea580c";
  }
}

async function handleTimerExpired() {
  console.log("⏱️ Payment timer expired!");
  
  // Clear timer from localStorage
  localStorage.removeItem("paymentStartTime");
  
  // Mark as expired to prevent any further saving
  paymentCompleted = true;
  
  // Update the current order to cancelled (order should already exist in Firebase)
  if (currentOrderId && currentUser) {
    try {
      const orderRef = doc(db, `users/${currentUser.uid}/orders`, currentOrderId);
      await updateDoc(orderRef, {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        cancelReason: "Waktu pembayaran habis"
      });
      console.log("✅ Order cancelled due to timeout:", currentOrderId);
      
      // Update spreadsheet status
      await saveToSpreadsheet(currentOrderId, { status: "cancelled" }, "update");
    } catch (err) {
      console.error("❌ Failed to cancel order:", err);
    }
  }
  
  // Clear localStorage
  localStorage.removeItem("pendingPayment");
  localStorage.removeItem("selectedClass");
  localStorage.removeItem("cartCheckoutItems");
  localStorage.removeItem("resumingOrderId");
  
  // Show expired message
  container.innerHTML = `
    <div style="text-align:center;padding:40px;background:#fef2f2;border-radius:16px;border:1px solid #fecaca;">
      <div style="font-size:64px;margin-bottom:16px;">⏰</div>
      <h2 style="color:#dc2626;margin-bottom:12px;font-size:24px;">Waktu Pembayaran Habis</h2>
      <p style="color:#7f1d1d;margin-bottom:24px;font-size:14px;">
        Maaf, waktu pembayaran Anda telah habis (1 jam). Pesanan Anda telah dibatalkan.
      </p>
      <a href="history.html" style="display:inline-block;padding:12px 24px;background:#dc2626;color:white;text-decoration:none;border-radius:8px;font-weight:600;">
        Lihat Riwayat Transaksi
      </a>
    </div>
  `;
  
  // Remove timer display
  const timerEl = document.getElementById("paymentTimer");
  if (timerEl) timerEl.remove();
}

// Clear timer on successful payment
function clearPaymentTimer() {
  localStorage.removeItem("paymentStartTime");
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  const timerEl = document.getElementById("paymentTimer");
  if (timerEl) timerEl.remove();
}

// === SAVE PENDING ORDER IMMEDIATELY ON PAGE LOAD ===
let currentOrderId = resumingOrderId; // Use existing order ID if resuming

async function saveOrderOnEntry() {
  // Skip if already resuming an existing order or no pending data
  if (resumingOrderId || !pending || !currentUser) {
    console.log("📝 Skipping save on entry - resuming:", resumingOrderId, "pending:", !!pending, "user:", !!currentUser);
    return;
  }
  
  console.log("💾 Saving pending order immediately on page entry...");
  
  try {
    // Calculate total items count
    const totalItems = (pending.items || []).reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
    
    // Extract customerInfo but EXCLUDE large base64 images for Firebase
    // Images will only be sent to the spreadsheet (saved to Google Drive)
    const customerInfoForFirebase = { ...(pending.customerInfo || {}) };
    delete customerInfoForFirebase.instagramProof; // Remove large base64 image
    
    const orderData = {
      items: pending.items,
      totalItems: totalItems, // Total quantity of all items
      total: pending.total,
      paymentMethod: method,
      shippingMethod: pending.shippingMethod || null,
      shippingCost: pending.shippingCost || 0,
      customerInfo: customerInfoForFirebase, // Customer info WITHOUT base64 images
      proofImage: null, // No proof yet (will be added later, but only URL stored)
      orderDate: new Date().toISOString(),
      userId: currentUser.uid,
      userEmail: currentUser.email,
      createdAt: serverTimestamp(),
      status: "pending_verification"
    };
    
    const orderRef = await addDoc(collection(db, `users/${currentUser.uid}/orders`), orderData);
    currentOrderId = orderRef.id;
    localStorage.setItem("resumingOrderId", currentOrderId);
    console.log("✅ Pending order saved to Firebase:", currentOrderId);
    
    // Send to spreadsheet WITH full customerInfo (including instagramProof for Drive upload)
    await saveToSpreadsheet(currentOrderId, { ...orderData, customerInfo: pending.customerInfo }, "create");
    
    // Clear pendingPayment since it's now saved to Firebase
    localStorage.removeItem("pendingPayment");
  } catch (err) {
    console.error("❌ Failed to save pending order on entry:", err);
  }
}

// === SAVE ORDER TO FIREBASE (Update existing pending order) ===
async function saveOrderToFirebase(orderData) {
  if (!currentUser) {
    console.error("❌ User not logged in, cannot save order");
    return null;
  }
  
  // Keep base64 images for spreadsheet, but don't store them in Firebase
  const proofImageForSpreadsheet = orderData.proofImage;
  
  // For Firebase, only store a flag that proof was uploaded (not the actual image)
  // This prevents exceeding Firebase's 1MB document limit
  const firebaseData = { ...orderData };
  firebaseData.proofImage = orderData.proofImage ? "uploaded" : null; // Just a flag, not base64
  
  // Also remove instagramProof if present in customerInfo
  if (firebaseData.customerInfo) {
    firebaseData.customerInfo = { ...firebaseData.customerInfo };
    delete firebaseData.customerInfo.instagramProof;
  }
  
  try {
    // We should always have currentOrderId since order is saved on entry
    if (currentOrderId) {
      console.log("📝 Updating existing order:", currentOrderId);
      const orderRef = doc(db, `users/${currentUser.uid}/orders`, currentOrderId);
      await updateDoc(orderRef, {
        ...firebaseData,
        updatedAt: serverTimestamp(),
        status: "verified"
      });
      console.log("✅ Order updated to Firebase:", currentOrderId);
      
      // Update spreadsheet WITH actual proof images (for Drive upload)
      await saveToSpreadsheet(currentOrderId, { 
        ...orderData, 
        proofImage: proofImageForSpreadsheet, // Send actual base64 to spreadsheet
        status: "verified",
        userId: currentUser.uid,
        userEmail: currentUser.email
      }, "update");
      
      localStorage.removeItem("resumingOrderId");
      return currentOrderId;
    } else {
      // Fallback: Create new order if somehow no currentOrderId exists
      console.log("⚠️ No currentOrderId, creating new order");
      const newFirebaseData = {
        ...firebaseData,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        createdAt: serverTimestamp(),
        status: "verified"
      };
      const orderRef = await addDoc(collection(db, `users/${currentUser.uid}/orders`), newFirebaseData);
      console.log("✅ Order saved to Firebase:", orderRef.id);
      
      // Save to spreadsheet with actual images
      await saveToSpreadsheet(orderRef.id, {
        ...orderData,
        proofImage: proofImageForSpreadsheet,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        status: "verified"
      }, "create");
      
      return orderRef.id;
    }
  } catch (err) {
    console.error("❌ Failed to save order:", err);
    return null;
  }
}

// === SHOW LOADING STATE ===
function showVerificationLoading() {
  container.innerHTML = `
    <div style="text-align:center;padding:48px;">
      <div class="loading-spinner" style="margin:0 auto 20px;width:60px;height:60px;border:4px solid #e5e7eb;border-top-color:#0aa678;border-radius:50%;animation:spin 1s linear infinite;"></div>
      <h3 style="color:#111827;margin-bottom:8px;">Memverifikasi Pembayaran...</h3>
      <p style="color:#6b7280;">Mohon tunggu sebentar, kami sedang memproses konfirmasi Anda.</p>
    </div>
    <style>
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;
}

if (!pending) {
  container.innerHTML = `
    <div style="text-align:center;padding:24px;">
      <p>❌ Data pembayaran tidak ditemukan.</p>
      <a href="payment.html" class="pay-btn" style="margin-top:16px;display:inline-block;">Kembali ke Pembayaran</a>
    </div>
  `;
  // Clear any stale timer
  localStorage.removeItem("paymentStartTime");
} else {
  // Initialize the payment timer
  const timerValid = initPaymentTimer();
  if (!timerValid) {
    // Timer expired, handleTimerExpired already showed the message
    // Skip rendering payment form
  } else {
  const { items, total } = pending;

  if (method === "bank") {
    container.innerHTML = `
      <div class="bank-transfer">
        <h3>Transfer ke salah satu rekening berikut:</h3>
        <ul>
          <li><strong>Bank Mandiri</strong>: 1380019145569 a.n. Ghazy Wira Pradipta</li>
          <li><strong>Bank BNI</strong>: 0707689611 a.n. Nur Sekti Waskitha Jati</li>
        </ul>

        <p style="margin-top:12px;">Total yang harus dibayar:
          <strong>Rp ${total.toLocaleString("id-ID")}</strong>
        </p>

        <label style="display:block;margin-top:20px;">Upload Bukti Transfer (max 10MB)</label>
        <input type="file" id="proofTransfer" accept="image/*" />
        <div id="errorMessage" style="display:none;color:#ef4444;font-size:13px;margin-top:6px;padding:8px 12px;background:#fef2f2;border-radius:6px;border:1px solid #fecaca;"></div>
        <div id="proofPreview"></div>
        <button id="confirmBtn" class="pay-btn" style="margin-top:16px;">Kirim Konfirmasi</button>
      </div>
    `;

    const input = document.getElementById("proofTransfer");
    const preview = document.getElementById("proofPreview");
    const confirmBtn = document.getElementById("confirmBtn");
    const errorMessage = document.getElementById("errorMessage");
    
    // Helper function to show error
    function showError(message) {
      errorMessage.textContent = message;
      errorMessage.style.display = "block";
      // Auto hide after 5 seconds
      setTimeout(() => {
        errorMessage.style.display = "none";
      }, 5000);
    }
    
    // Helper function to hide error
    function hideError() {
      errorMessage.style.display = "none";
    }
    
    input.addEventListener("change", () => {
      hideError();
      const file = input.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        showError("❌ Ukuran file maksimal 10MB!");
        input.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        preview.innerHTML = `<img src="${e.target.result}" alt="Bukti Transfer" style="max-width:200px;border-radius:8px;margin-top:8px;">`;
      };
      reader.readAsDataURL(file);
    });
    
    // Handle confirm button click
    confirmBtn.addEventListener("click", async () => {
      hideError();
      const file = input.files[0];
      if (!file) {
        showError("❌ Silakan upload bukti transfer terlebih dahulu!");
        return;
      }
      
      if (!currentUser) {
        showError("❌ Silakan login terlebih dahulu!");
        return;
      }
      
      // Show loading state
      showVerificationLoading();
      const loadingStartTime = Date.now();
      const MIN_LOADING_TIME = 3000; // Minimum 3 seconds loading
      const MAX_LOADING_TIME = 10000; // Maximum 10 seconds loading
      let processCompleted = false;
      
      // Helper function to show success and redirect
      async function showSuccessAndRedirect() {
        if (processCompleted) return; // Prevent duplicate calls
        processCompleted = true;
        
        container.innerHTML = `
          <div style="text-align:center;padding:48px;">
            <div style="font-size:64px;margin-bottom:16px;">✅</div>
            <h3 style="color:#10b981;margin-bottom:8px;">Pembayaran Dikonfirmasi!</h3>
            <p style="color:#6b7280;">Mengalihkan ke halaman riwayat...</p>
          </div>
        `;
        
        // Delete purchased items from cart
        await deletePurchasedItemsFromCart();
        
        // Redirect after 3 seconds
        setTimeout(() => {
          window.location.href = "history.html";
        }, 3000);
      }
      
      // Set a maximum timeout - force show success after 10 seconds
      const maxTimeout = setTimeout(() => {
        console.log("⚠️ Max loading time reached, showing success");
        showSuccessAndRedirect();
      }, MAX_LOADING_TIME);
      
      try {
        // Step 1: Update Firebase status to "verified"
        if (currentOrderId) {
          console.log("📝 Updating order status to verified...");
          const orderRef = doc(db, `users/${currentUser.uid}/orders`, currentOrderId);
          await updateDoc(orderRef, {
            proofImage: "uploaded", // Flag only, not actual image
            updatedAt: serverTimestamp(),
            status: "verified"
          });
          console.log("✅ Order status updated to verified");
        }
        
        // Step 2: Mark payment as completed and cleanup
        paymentCompleted = true;
        clearPaymentTimer();
        localStorage.removeItem("pendingPayment");
        localStorage.removeItem("selectedClass");
        localStorage.removeItem("cartCheckoutItems");
        localStorage.removeItem("resumingOrderId");
        
        // Step 3: Upload proof to spreadsheet in BACKGROUND (fire-and-forget)
        const reader = new FileReader();
        reader.onload = (e) => {
          const proofImage = e.target.result;
          console.log("📷 Uploading proof to spreadsheet in background...");
          
          const orderData = {
            items: pending?.items || [],
            total: pending?.total || 0,
            paymentMethod: method,
            shippingMethod: pending?.shippingMethod || null,
            shippingCost: pending?.shippingCost || 0,
            customerInfo: pending?.customerInfo || {},
            proofImage: proofImage,
            status: "verified",
            userId: currentUser.uid,
            userEmail: currentUser.email,
            orderDate: new Date().toISOString()
          };
          
          // Non-blocking spreadsheet save
          saveToSpreadsheet(currentOrderId, orderData, "update");
        };
        reader.readAsDataURL(file);
        
        // Step 4: Wait for minimum loading time then show success
        const elapsedTime = Date.now() - loadingStartTime;
        const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);
        
        console.log("⏱️ Elapsed:", elapsedTime, "ms, Waiting:", remainingTime, "ms more");
        
        setTimeout(() => {
          clearTimeout(maxTimeout);
          showSuccessAndRedirect();
        }, remainingTime);
        
      } catch (err) {
        console.error("❌ Error confirming payment:", err);
        container.innerHTML = `
          <div style="text-align:center;padding:24px;">
            <p>❌ Gagal mengkonfirmasi: ${err.message}</p>
            <button onclick="location.reload()" class="pay-btn" style="margin-top:16px;">Coba Lagi</button>
          </div>
        `;
      }
    });
  }

  else if (method === "qris") {
    container.innerHTML = `
      <div class="qris-payment" style="text-align:center;">
        <h3>QRIS Pembayaran</h3>
        <p>Total yang harus dibayar:
          <strong>Rp ${total.toLocaleString("id-ID")}</strong>
        </p>
        <div id="qrisContainer" style="margin:16px auto;"></div>
        <p style="color:#6b7280;">Scan QRIS dengan aplikasi e-wallet Anda untuk menyelesaikan pembayaran.</p>
      </div>
    `;
  
    try {
      const r = await fetch("http://localhost:3000/api/xendit/create_qris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: total, orderId: pending.orderId || "local" })
      });
      const data = await r.json();
      if (data.success && data.qrImage) {
        document.getElementById("qrisContainer").innerHTML = `
          <img src="data:image/png;base64,${data.qrImage}" alt="QRIS" style="max-width:300px;border-radius:8px;box-shadow:0 0 6px rgba(0,0,0,0.1);">
        `;
      } else {
        document.getElementById("qrisContainer").innerHTML = "<p>Gagal memuat QRIS.</p>";
        console.error('QRIS error payload:', data);
      }
    } catch (err) {
      console.error("❌ Gagal load QRIS:", err);
      document.getElementById("qrisContainer").innerHTML = "<p>Gagal memuat QRIS.</p>";
    }
  }
  

  else {
    container.innerHTML = `<p>Metode pembayaran tidak dikenali.</p>`;
  }
  } // Close timerValid if block
}
