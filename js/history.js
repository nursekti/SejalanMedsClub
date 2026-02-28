// js/history.js
console.log("📜 history.js loaded");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, updateDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

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

const kelasHistoryList = document.getElementById("kelasHistoryList");
const shopHistoryList = document.getElementById("shopHistoryList");
const logoutBtn = document.getElementById("logoutBtn");
const logoutBtnDropdown = document.getElementById("logoutBtnDropdown");

// === GOOGLE SPREADSHEET INTEGRATION ===
let sheetWebAppUrl = null;

async function getSheetConfig() {
  try {
    const sheetDoc = await getDoc(doc(db, "sheet", "sheet1"));
    if (sheetDoc.exists()) {
      const data = sheetDoc.data();
      sheetWebAppUrl = data.url;
      console.log("📊 Sheet URL loaded");
      return data;
    }
    return null;
  } catch (err) {
    console.error("❌ Failed to load sheet config:", err);
    return null;
  }
}

// Update order status in spreadsheet
async function updateSpreadsheetStatus(orderId, newStatus) {
  if (!sheetWebAppUrl) {
    await getSheetConfig();
  }
  
  if (!sheetWebAppUrl) return false;
  
  try {
    const response = await fetch(sheetWebAppUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        orderId: orderId,
        status: newStatus,
        updatedAt: new Date().toISOString()
      })
    });
    console.log("📊 Spreadsheet status update sent");
    return true;
  } catch (err) {
    console.error("❌ Failed to update spreadsheet:", err);
    return false;
  }
}

// Initialize sheet config
getSheetConfig();

// === HELPER: Check if order contains kelas/webinar items ===
function isKelasWebinarOrder(order) {
  if (!order.items || order.items.length === 0) return false;
  return order.items.some(item => {
    const itemType = (item.type || '').toLowerCase().trim();
    return itemType === 'kelas' || itemType === 'webinar';
  });
}

// === HELPER: Check if order contains shop (physical) items ===
function isShopOrder(order) {
  if (!order.items || order.items.length === 0) return false;
  return order.items.some(item => {
    const itemType = (item.type || '').toLowerCase().trim();
    return itemType !== 'kelas' && itemType !== 'webinar';
  });
}

// === PAYMENT TIMER CONSTANT ===
const PAYMENT_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour in milliseconds

// === TIMER HELPERS ===
function getRemainingTime(createdAt) {
  if (!createdAt) return -1;
  const startTime = createdAt.toDate ? createdAt.toDate().getTime() : new Date(createdAt).getTime();
  const deadline = startTime + PAYMENT_TIMEOUT_MS;
  const remaining = deadline - Date.now();
  return remaining;
}

function formatTimeRemaining(ms) {
  if (ms <= 0) return "Kadaluarsa";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// === FORMAT HELPERS ===
function formatRupiah(num) {
  return "Rp " + (num || 0).toLocaleString("id-ID");
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getStatusBadge(status) {
  const statusMap = {
    "pending_verification": { label: "Menunggu Verifikasi", color: "#f59e0b", bg: "#fef3c7" },
    "verified": { label: "Terverifikasi", color: "#10b981", bg: "#d1fae5" },
    "processing": { label: "Diproses", color: "#3b82f6", bg: "#dbeafe" },
    "shipped": { label: "Dikirim", color: "#8b5cf6", bg: "#ede9fe" },
    "completed": { label: "Selesai", color: "#059669", bg: "#a7f3d0" },
    "cancelled": { label: "Dibatalkan", color: "#ef4444", bg: "#fee2e2" }
  };
  
  const s = statusMap[status] || { label: status || "Unknown", color: "#6b7280", bg: "#f3f4f6" };
  return `<span style="padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;color:${s.color};background:${s.bg};">${s.label}</span>`;
}

// === LOAD ORDER HISTORY ===
async function loadOrderHistory(userId) {
  kelasHistoryList.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:#6b7280;">Memuat data...</td></tr>`;
  shopHistoryList.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:#6b7280;">Memuat data...</td></tr>`;
  
  try {
    const ordersRef = collection(db, `users/${userId}/orders`);
    const q = query(ordersRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      kelasHistoryList.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:#6b7280;">Belum ada riwayat transaksi kelas.</td></tr>`;
      shopHistoryList.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:#6b7280;">Belum ada riwayat transaksi produk.</td></tr>`;
      return;
    }
    
    let kelasHtml = "";
    let shopHtml = "";
    const expiredOrderIds = []; // Track orders that need to be cancelled
    
    snapshot.forEach(doc => {
      const order = doc.data();
      const orderId = doc.id;
      
      // Separate items by type
      const kelasItems = (order.items || []).filter(item => {
        const itemType = (item.type || '').toLowerCase().trim();
        return itemType === 'kelas' || itemType === 'webinar';
      });
      
      const shopItems = (order.items || []).filter(item => {
        const itemType = (item.type || '').toLowerCase().trim();
        return itemType !== 'kelas' && itemType !== 'webinar';
      });
      
      // Format date
      let dateStr = "-";
      if (order.createdAt) {
        const date = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
        dateStr = formatDate(date);
      } else if (order.orderDate) {
        dateStr = formatDate(order.orderDate);
      }
      
      // Check if order is pending verification
      let isPending = order.status === "pending_verification";
      let timerDisplay = '';
      let actionBtn = '';
      
      if (isPending) {
        const remainingMs = getRemainingTime(order.createdAt);
        
        if (remainingMs <= 0) {
          expiredOrderIds.push(orderId);
          isPending = false;
        } else {
          const isUrgent = remainingMs < 15 * 60 * 1000;
          const urgentColor = isUrgent ? '#ef4444' : '#f59e0b';
          timerDisplay = `
            <div data-timer-id="${orderId}" data-created-at="${order.createdAt.toDate ? order.createdAt.toDate().getTime() : new Date(order.createdAt).getTime()}" 
              style="font-size:11px;color:${urgentColor};margin-top:4px;font-family:monospace;font-weight:600;">
              ⏱️ ${formatTimeRemaining(remainingMs)}
            </div>
          `;
          actionBtn = `
            <button class="continue-payment-btn" data-order-id="${orderId}" 
              style="margin-top:6px;padding:6px 12px;background:#0aa678;color:white;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
              Lanjutkan Pembayaran
            </button>
          `;
        }
      }
      
      const displayStatus = expiredOrderIds.includes(orderId) ? 'cancelled' : order.status;
      
      // Generate row for Kelas & Webinar table (if has kelas items)
      if (kelasItems.length > 0) {
        const kelasItemNames = kelasItems.map(item => item.title || item.name || "Item").join(", ");
        const truncatedKelasItems = kelasItemNames.length > 50 ? kelasItemNames.substring(0, 50) + "..." : kelasItemNames;
        // Calculate subtotal for kelas items only
        const kelasSubtotal = kelasItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 1)), 0);
        
        kelasHtml += `
          <tr class="order-row" data-order-id="${orderId}" style="cursor:pointer;">
            <td>${dateStr}</td>
            <td title="${kelasItemNames}">${truncatedKelasItems}</td>
            <td>${formatRupiah(kelasSubtotal)}</td>
            <td>
              ${getStatusBadge(displayStatus)}
              ${timerDisplay}
              ${actionBtn}
            </td>
          </tr>
        `;
      }
      
      // Generate row for Shop table (if has shop items)
      if (shopItems.length > 0) {
        const shopItemNames = shopItems.map(item => item.title || item.name || "Item").join(", ");
        const truncatedShopItems = shopItemNames.length > 50 ? shopItemNames.substring(0, 50) + "..." : shopItemNames;
        // Calculate subtotal for shop items only (including shipping if applicable)
        let shopSubtotal = shopItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 1)), 0);
        // Add shipping cost if this order has physical items
        if (order.shippingCost) {
          shopSubtotal += Number(order.shippingCost);
        }
        
        shopHtml += `
          <tr class="order-row" data-order-id="${orderId}" style="cursor:pointer;">
            <td>${dateStr}</td>
            <td title="${shopItemNames}">${truncatedShopItems}</td>
            <td>${formatRupiah(shopSubtotal)}</td>
            <td>
              ${getStatusBadge(displayStatus)}
              ${timerDisplay}
              ${actionBtn}
            </td>
          </tr>
        `;
      }
    });
    
    // Render separate tables
    kelasHistoryList.innerHTML = kelasHtml || `<tr><td colspan="4" style="text-align:center;padding:20px;color:#6b7280;">Belum ada riwayat transaksi kelas.</td></tr>`;
    shopHistoryList.innerHTML = shopHtml || `<tr><td colspan="4" style="text-align:center;padding:20px;color:#6b7280;">Belum ada riwayat transaksi produk.</td></tr>`;
    
    // Cancel expired orders in Firebase
    if (expiredOrderIds.length > 0) {
      console.log("⏱️ Cancelling expired orders:", expiredOrderIds);
      for (const orderId of expiredOrderIds) {
        try {
          const orderRef = doc(db, `users/${userId}/orders`, orderId);
          await updateDoc(orderRef, {
            status: "cancelled",
            cancelledAt: serverTimestamp(),
            cancelReason: "Waktu pembayaran habis"
          });
          console.log("✅ Cancelled expired order:", orderId);
          
          // Update spreadsheet status
          await updateSpreadsheetStatus(orderId, "cancelled");
        } catch (err) {
          console.error("❌ Failed to cancel order:", orderId, err);
        }
      }
    }
    
    // Start timer update interval for pending orders
    startTimerUpdates();
    
    // Add click handlers for "Continue Payment" buttons
    document.querySelectorAll(".continue-payment-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent row click
        const orderId = btn.dataset.orderId;
        const order = snapshot.docs.find(d => d.id === orderId)?.data();
        
        if (order) {
          // Save order data to localStorage for confirmPayment page
          const pendingPayment = {
            items: order.items,
            total: order.total,
            paymentMethod: order.paymentMethod,
            shippingMethod: order.shippingMethod,
            shippingCost: order.shippingCost,
            orderId: orderId // Include orderId to update existing order
          };
          localStorage.setItem("pendingPayment", JSON.stringify(pendingPayment));
          localStorage.setItem("resumingOrderId", orderId);
          
          // Restore the original payment start time so timer continues from where it was
          const originalStartTime = order.createdAt.toDate ? order.createdAt.toDate().getTime() : new Date(order.createdAt).getTime();
          localStorage.setItem("paymentStartTime", originalStartTime.toString());
          
          // Redirect to confirmPayment
          window.location.href = `confirmPayment.html?method=${order.paymentMethod || 'bank'}`;
        }
      });
    });
    
    // Add click handlers to show order details
    document.querySelectorAll(".order-row").forEach(row => {
      row.addEventListener("click", () => {
        const orderId = row.dataset.orderId;
        showOrderDetails(orderId, snapshot.docs.find(d => d.id === orderId)?.data());
      });
    });
    
  } catch (err) {
    console.error("❌ Failed to load order history:", err);
    historyList.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:#ef4444;">Gagal memuat riwayat transaksi.</td></tr>`;
  }
}

// === TIMER UPDATE INTERVAL ===
let timerUpdateInterval = null;

function startTimerUpdates() {
  // Clear any existing interval
  if (timerUpdateInterval) {
    clearInterval(timerUpdateInterval);
  }
  
  timerUpdateInterval = setInterval(() => {
    const timerElements = document.querySelectorAll("[data-timer-id]");
    
    timerElements.forEach(el => {
      const createdAt = parseInt(el.dataset.createdAt);
      const deadline = createdAt + PAYMENT_TIMEOUT_MS;
      const remaining = deadline - Date.now();
      
      if (remaining <= 0) {
        // Timer expired - reload the page to update status
        clearInterval(timerUpdateInterval);
        window.location.reload();
      } else {
        // Update display
        const isUrgent = remaining < 15 * 60 * 1000;
        el.style.color = isUrgent ? '#ef4444' : '#f59e0b';
        el.textContent = `⏱️ ${formatTimeRemaining(remaining)}`;
      }
    });
  }, 1000);
}

// Clean up on page unload
window.addEventListener("beforeunload", () => {
  if (timerUpdateInterval) {
    clearInterval(timerUpdateInterval);
  }
});

// === SHOW ORDER DETAILS MODAL ===
function showOrderDetails(orderId, order) {
  if (!order) return;
  
  // Create modal
  const modal = document.createElement("div");
  modal.id = "orderDetailModal";
  modal.style.cssText = `
    position:fixed;top:0;left:0;right:0;bottom:0;
    background:rgba(0,0,0,0.5);
    display:flex;align-items:center;justify-content:center;
    z-index:10000;
    padding:20px;
  `;
  
  // Separate items by type
  const kelasItems = (order.items || []).filter(item => {
    const itemType = (item.type || '').toLowerCase().trim();
    return itemType === 'kelas' || itemType === 'webinar';
  });
  
  const shopItems = (order.items || []).filter(item => {
    const itemType = (item.type || '').toLowerCase().trim();
    return itemType !== 'kelas' && itemType !== 'webinar';
  });
  
  // Generate item HTML helper
  const renderItemHtml = (item) => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e5e7eb;">
      <div>
        <strong>${item.title || item.name || "Item"}</strong><br>
        <small style="color:#6b7280;">${item.qty || 1} × ${formatRupiah(item.price)}</small>
      </div>
      <div style="font-weight:600;">${formatRupiah((item.price || 0) * (item.qty || 1))}</div>
    </div>
  `;
  
  // Calculate subtotals
  const kelasSubtotal = kelasItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 1)), 0);
  let shopSubtotal = shopItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 1)), 0);
  const shippingCost = Number(order.shippingCost) || 0;
  if (shopItems.length > 0 && shippingCost > 0) {
    shopSubtotal += shippingCost;
  }
  
  // Build Kelas & Webinar section
  let kelasSection = '';
  if (kelasItems.length > 0) {
    kelasSection = `
      <div style="margin-top:20px;padding:16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
        <strong style="display:block;margin-bottom:12px;color:#166534;">📚 Kelas & Webinar</strong>
        ${kelasItems.map(renderItemHtml).join("")}
        <div style="display:flex;justify-content:space-between;padding:12px 0 0 0;font-weight:600;color:#166534;">
          <span>Subtotal Kelas</span>
          <span>${formatRupiah(kelasSubtotal)}</span>
        </div>
      </div>
    `;
  }
  
  // Build Shop section
  let shopSection = '';
  if (shopItems.length > 0) {
    shopSection = `
      <div style="margin-top:20px;padding:16px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe;">
        <strong style="display:block;margin-bottom:12px;color:#1e40af;">🛒 Produk Shop</strong>
        ${shopItems.map(renderItemHtml).join("")}
        ${shippingCost > 0 ? `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #bfdbfe;color:#0369a1;">
            <span>Ongkir</span>
            <span>${formatRupiah(shippingCost)}</span>
          </div>
        ` : ''}
        <div style="display:flex;justify-content:space-between;padding:12px 0 0 0;font-weight:600;color:#1e40af;">
          <span>Subtotal Produk</span>
          <span>${formatRupiah(shopSubtotal)}</span>
        </div>
      </div>
    `;
  }
  
  // Format date
  let dateStr = "-";
  if (order.createdAt) {
    const date = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
    dateStr = formatDate(date);
  } else if (order.orderDate) {
    dateStr = formatDate(order.orderDate);
  }
  
  modal.innerHTML = `
    <div style="background:white;border-radius:12px;max-width:500px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 50px rgba(0,0,0,0.2);">
      <div style="padding:20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
        <h3 style="margin:0;">Detail Pesanan</h3>
        <button id="closeModal" style="background:none;border:none;font-size:24px;cursor:pointer;color:#6b7280;">&times;</button>
      </div>
      
      <div style="padding:20px;">
        <div style="margin-bottom:16px;">
          <small style="color:#6b7280;">ID Pesanan</small>
          <div style="font-family:monospace;font-size:12px;color:#374151;">${orderId}</div>
        </div>
        
        <div style="margin-bottom:16px;">
          <small style="color:#6b7280;">Tanggal</small>
          <div>${dateStr}</div>
        </div>
        
        <div style="margin-bottom:16px;">
          <small style="color:#6b7280;">Status</small>
          <div style="margin-top:4px;">${getStatusBadge(order.status)}</div>
        </div>
        
        <div style="margin-bottom:16px;">
          <small style="color:#6b7280;">Metode Pembayaran</small>
          <div style="text-transform:uppercase;">${order.paymentMethod || "-"}</div>
        </div>
        
        ${order.shippingMethod ? `
          <div style="margin-bottom:16px;">
            <small style="color:#6b7280;">Metode Pengiriman</small>
            <div>${order.shippingMethod === 'cod' ? '📦 COD Kolektif' : '🚚 Dikirim ke Alamat'}</div>
          </div>
        ` : ''}
        
        ${kelasSection}
        ${shopSection}
        
        <div style="margin-top:20px;padding-top:16px;border-top:2px solid #e5e7eb;">
          <div style="display:flex;justify-content:space-between;padding:12px 0;font-weight:700;font-size:18px;color:#111827;">
            <span>Total Keseluruhan</span>
            <span>${formatRupiah(order.total)}</span>
          </div>
        </div>
        
        ${order.proofImage ? `
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;">
            <small style="color:#6b7280;">Bukti Transfer:</small>
            ${order.proofImage.startsWith('data:') ? 
              `<img src="${order.proofImage}" alt="Bukti Transfer" style="max-width:100%;border-radius:8px;margin-top:8px;">` :
              `<div style="margin-top:8px;padding:12px;background:#d1fae5;border-radius:8px;color:#065f46;font-size:14px;">
                ✅ Bukti transfer telah diunggah
              </div>`
            }
          </div>
        ` : ''}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close modal handlers
  document.getElementById("closeModal").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

// === AUTH STATE ===
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    console.log("✅ User logged in:", user.email);
    loadOrderHistory(user.uid);
  }
});

// === LOGOUT ===
logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

logoutBtnDropdown?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

