// js/cart.js
console.log("🛒 cart.js (Firestore User Cart - final stable) loaded");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { showLoginModal, showErrorToast } from './ui-utils.js';

// === Firebase Config ===
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
const auth = getAuth();

let currentUser = null;
let unsubscribeCartSnapshot = null;

// === UTIL ===
function formatRupiah(num) {
  return "Rp " + (num || 0).toLocaleString("id-ID");
}

/* ===== Firestore Helpers ===== */
async function setCartItem(id, data) {
  if (!currentUser) return;
  const ref = doc(db, `users/${currentUser.uid}/cart/${id}`);
  await setDoc(ref, data, { merge: true });
}

async function removeCartItem(id) {
  if (!currentUser) return;
  await deleteDoc(doc(db, `users/${currentUser.uid}/cart/${id}`));
}

/* ===== Render Cart UI ===== */
function renderCartUI(items) {
  const cartContainer = document.querySelector(".cart-items");
  const totalItemsEl = document.getElementById("totalItems");
  const totalPriceEl = document.getElementById("totalPrice");
  const selectAllControls = document.getElementById("selectAllControls");
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");

  if (!cartContainer) return;

  if (!items) {
    cartContainer.innerHTML = `<p style="text-align:center;color:#6b7280;">Memuat keranjang...</p>`;
    if (selectAllControls) selectAllControls.style.display = "none";
    return;
  }

  if (items.length === 0) {
    cartContainer.innerHTML = "<p>Keranjang kosong.</p>";
    if (totalItemsEl) totalItemsEl.textContent = "0";
    if (totalPriceEl) totalPriceEl.textContent = "Rp 0";
    if (selectAllControls) selectAllControls.style.display = "none";
    return;
  }
  
  // Show select all controls when cart has items
  if (selectAllControls) {
    selectAllControls.style.display = "block";
    if (selectAllCheckbox) selectAllCheckbox.checked = true;
  }

  cartContainer.innerHTML = "";
  console.log("🛒 [CART] renderCartUI - all items from Firestore:", items);
  items.forEach(item => {
    console.log("🛒 [CART] Rendering item:", item.title, "hasNameTag:", item.hasNameTag, "type:", typeof item.hasNameTag);
    const safeQty = Number(item.qty) || 1;
    const subtotal = (Number(item.price) || 0) * safeQty;
    const hasNameTag = item.hasNameTag === true ? "true" : "false";
    const numOfNametag = item.numOfNametag || 0;
    const itemType = (item.type || "").toLowerCase();
    
    // Check if this is a kelas/webinar item (max qty = 1)
    const isKelasWebinar = itemType === "kelas" || itemType === "webinar";
    const isPlusDisabled = isKelasWebinar && safeQty >= 1;
    
    console.log("🛒 [CART] Converted hasNameTag for data attr:", hasNameTag);
    const html = `
      <div class="cart-item" data-id="${item.id}" data-price="${item.price}" data-hasnametag="${hasNameTag}" data-numofnametag="${numOfNametag}" data-type="${itemType}">
        <input type="checkbox" class="cart-check" checked>
        <img src="${item.image || 'assets/placeholder.png'}" alt="${item.title}">
        <div class="item-info">
          <h3>${item.title}</h3>
          <p class="muted">${item.type || ''}</p>
          <p class="muted price-label">Harga: ${formatRupiah(item.price)}</p>
          <div class="qty-control">
            <button class="minus">−</button>
            <input type="number" min="1" ${isKelasWebinar ? 'max="1"' : ''} value="${safeQty}" ${isKelasWebinar ? 'readonly' : ''}>
            <button class="plus" ${isPlusDisabled ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>＋</button>
          </div>
          ${isKelasWebinar ? '<p class="qty-note" style="font-size:11px;color:#5c6bc0;margin-top:4px;">Maks. 1 per kelas</p>' : ''}
          <div class="item-total">Subtotal: ${formatRupiah(subtotal)}</div>
        </div>
      </div>`;
    cartContainer.insertAdjacentHTML("beforeend", html);
  });

  updateSummary();
}

/* ===== Update Summary ===== */
function updateSummary() {
  let totalItems = 0;
  let totalPrice = 0;

  document.querySelectorAll(".cart-item").forEach(item => {
    const check = item.querySelector(".cart-check");
    const qty = parseInt(item.querySelector(".qty-control input").value) || 1;
    const price = Number(item.dataset.price) || 0;
    const itemTotal = price * qty;
    item.querySelector(".item-total").textContent = "Subtotal: " + formatRupiah(itemTotal);

    if (check?.checked) {
      totalItems += qty;
      totalPrice += itemTotal;
    }
  });

  const totalItemsEl = document.getElementById("totalItems");
  const totalPriceEl = document.getElementById("totalPrice");
  if (totalItemsEl) totalItemsEl.textContent = totalItems;
  if (totalPriceEl) totalPriceEl.textContent = formatRupiah(totalPrice);
}

/* ===== Update Select All Checkbox ===== */
function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  if (!selectAllCheckbox) return;
  
  const allCheckboxes = document.querySelectorAll(".cart-item .cart-check");
  const checkedCount = document.querySelectorAll(".cart-item .cart-check:checked").length;
  
  if (allCheckboxes.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  } else if (checkedCount === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  } else if (checkedCount === allCheckboxes.length) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else {
    // Some items selected - show indeterminate state
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  }
}

/* ===== Delete Confirmation Modal ===== */
function showDeleteConfirmModal(itemTitle, onConfirm, onCancel) {
  // Remove existing modal if any
  const existingModal = document.getElementById("deleteConfirmModal");
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement("div");
  modal.id = "deleteConfirmModal";
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    z-index: 10000;
  `;
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 12px; padding: 24px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.2);">
      <div style="font-size: 48px; margin-bottom: 16px;">🗑️</div>
      <h3 style="margin: 0 0 12px 0; color: #111827;">Hapus dari Keranjang?</h3>
      <p style="color: #6b7280; margin-bottom: 24px;">
        <strong>"${itemTitle}"</strong> akan dihapus dari keranjang Anda.
      </p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="cancelDeleteBtn" style="padding: 10px 24px; background: #f3f4f6; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; color: #374151;">
          Batal
        </button>
        <button id="confirmDeleteBtn" style="padding: 10px 24px; background: #ef4444; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
          Ya, Hapus
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById("confirmDeleteBtn").addEventListener("click", () => {
    modal.remove();
    if (onConfirm) onConfirm();
  });
  
  document.getElementById("cancelDeleteBtn").addEventListener("click", () => {
    modal.remove();
    if (onCancel) onCancel();
  });
  
  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
      if (onCancel) onCancel();
    }
  });
}

/* ===== Event Delegation ===== */
function attachDelegatedListeners() {
  const cartContainer = document.querySelector(".cart-items");
  if (!cartContainer || window.cartDelegationAttached) return;
  window.cartDelegationAttached = true;

  cartContainer.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const itemEl = btn.closest(".cart-item");
    if (!itemEl) return;

    const id = itemEl.dataset.id;
    const input = itemEl.querySelector(".qty-control input");
    let qty = parseInt(input.value) || 1;
    const itemTitle = itemEl.querySelector("h3")?.textContent || "Item";
    const itemType = (itemEl.dataset.type || "").toLowerCase();
    const isKelasWebinar = itemType === "kelas" || itemType === "webinar";

    if (btn.classList.contains("plus")) {
      // For kelas/webinar, max qty is 1
      if (isKelasWebinar && qty >= 1) {
        console.log("⚠️ Max quantity (1) reached for kelas/webinar");
        return;
      }
      qty += 1;
      input.value = qty;
      await setCartItem(id, { qty });
      updateSummary();
    } else if (btn.classList.contains("minus")) {
      if (qty <= 1) {
        // Show confirmation modal when trying to go below 1
        showDeleteConfirmModal(
          itemTitle,
          async () => {
            // On confirm - delete item
            await removeCartItem(id);
            console.log("🗑️ Item deleted from cart:", id);
          },
          () => {
            // On cancel - do nothing, keep qty at 1
            console.log("❌ Delete cancelled, keeping item");
          }
        );
      } else {
        qty -= 1;
        input.value = qty;
        await setCartItem(id, { qty });
        updateSummary();
      }
    }
  });

  cartContainer.addEventListener("input", async (e) => {
    if (!e.target.matches(".qty-control input")) return;
    const input = e.target;
    const itemEl = input.closest(".cart-item");
    const id = itemEl.dataset.id;
    const itemType = (itemEl.dataset.type || "").toLowerCase();
    const isKelasWebinar = itemType === "kelas" || itemType === "webinar";
    
    let val = parseInt(input.value) || 1;
    if (val < 1) val = 1;
    // For kelas/webinar, max qty is 1
    if (isKelasWebinar && val > 1) val = 1;
    input.value = val;
    await setCartItem(id, { qty: val });
    updateSummary();
  });

  cartContainer.addEventListener("change", (e) => {
    if (e.target.matches(".cart-check")) {
      updateSummary();
      updateSelectAllCheckbox();
    }
  });
  
  // Select All checkbox handler
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  if (selectAllCheckbox && !selectAllCheckbox.hasListener) {
    selectAllCheckbox.hasListener = true;
    selectAllCheckbox.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      document.querySelectorAll(".cart-item .cart-check").forEach(checkbox => {
        checkbox.checked = isChecked;
      });
      updateSummary();
      console.log(isChecked ? "✅ Selected all items" : "❌ Deselected all items");
    });
  }

  const checkoutBtn = document.getElementById("checkoutBtn");
  if (checkoutBtn && !checkoutBtn.hasListener) {
    checkoutBtn.addEventListener("click", checkout);
    checkoutBtn.hasListener = true;
  }
}

/* ===== Checkout ===== */
async function checkout() {
  if (!currentUser) {
    showLoginModal("Silakan login terlebih dahulu untuk checkout.");
    return;
  }

  const selected = [];
  document.querySelectorAll(".cart-item").forEach((item) => {
    if (item.querySelector(".cart-check")?.checked) {
      const id = item.dataset.id;
      const title = item.querySelector("h3").textContent;
      const price = parseInt(item.dataset.price);
      const qty = parseInt(item.querySelector(".qty-control input").value);
      const image = item.querySelector("img").src;
      const type = item.querySelector(".muted").textContent;
      const hasNameTag = item.dataset.hasnametag === "true";
      const numOfNametag = parseInt(item.dataset.numofnametag) || 0;
      console.log("🛒 [CART] Item checkout:", { id, title, hasNameTag, numOfNametag });
      console.log("🛒 [CART] Raw dataset.hasnametag:", item.dataset.hasnametag);
      selected.push({ id, title, price, qty, image, type, hasNameTag, numOfNametag });
    }
  });
  console.log("🛒 [CART] All selected items:", selected);

  if (selected.length === 0) {
    showErrorToast("Pilih minimal 1 item untuk checkout!");
    return;
  }

  const total = selected.reduce((sum, i) => sum + i.price * i.qty, 0);
  
  // Save selected items to localStorage for payment page
  localStorage.setItem("cartCheckoutItems", JSON.stringify(selected));
  
  // Also save item IDs to delete from cart after successful payment
  const itemIdsToDelete = selected.map(item => item.id);
  localStorage.setItem("cartItemsToDelete", JSON.stringify(itemIdsToDelete));
  
  // Clear any stale data from previous purchases
  localStorage.removeItem("selectedClass");
  localStorage.removeItem("resumingOrderId");
  localStorage.removeItem("paymentStartTime");
  
  console.log("🛒 Checkout items saved:", selected.length, "items, total:", total);
  console.log("🛒 Items to delete after payment:", itemIdsToDelete);
  
  // Redirect to payment page
  window.location.href = "payment.html";
}

/* ===== Delete Purchased Items from Cart ===== */
// Called when returning from successful payment
async function deletePurchasedItemsFromCart() {
  const itemIds = JSON.parse(localStorage.getItem("cartItemsToDelete") || "[]");
  if (itemIds.length === 0 || !currentUser) return;
  
  console.log("🗑️ Deleting purchased items from cart:", itemIds);
  
  for (const id of itemIds) {
    try {
      await removeCartItem(id);
      console.log("✅ Deleted from cart:", id);
    } catch (err) {
      console.error("❌ Failed to delete from cart:", id, err);
    }
  }
  
  // Clear the list
  localStorage.removeItem("cartItemsToDelete");
}

// Export for use in confirmPayment.js
window.deletePurchasedItemsFromCart = deletePurchasedItemsFromCart;

/* ===== Auth + Firestore Realtime ===== */
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  const cartContainer = document.querySelector(".cart-items");

  if (!user) {
    if (unsubscribeCartSnapshot) unsubscribeCartSnapshot();
    if (cartContainer) cartContainer.innerHTML = "<p>Silakan login untuk melihat keranjang.</p>";
    document.getElementById("totalItems").textContent = "0";
    document.getElementById("totalPrice").textContent = "Rp 0";
    return;
  }

  const col = collection(db, `users/${user.uid}/cart`);
  if (unsubscribeCartSnapshot) unsubscribeCartSnapshot();

  unsubscribeCartSnapshot = onSnapshot(col, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCartUI(items);
    attachDelegatedListeners();
  }, (err) => console.error("cart snapshot error:", err));
});
