// js/kelas.js
console.log("🔥 kelas.js (Firestore User Cart) loaded");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  getDoc,
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

// state used for filtering / searching / sorting
let currentFilter = 'all';
let currentQuery = '';
let currentSort = '';
let allCards = [];

function formatRupiah(num) {
  return "Rp " + (num || 0).toLocaleString("id-ID");
}

/* ========= Firestore cart helpers ========= */
async function getCartFirestore() {
  if (!currentUser) return [];
  const snap = await getDocs(collection(db, `users/${currentUser.uid}/cart`));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Add / increment — use getDoc first so qty increments correctly
async function addToCartFirestore(item) {
  if (!currentUser) {
    showLoginModal("Silakan login terlebih dahulu untuk menambahkan ke keranjang.");
    return;
  }
  const ref = doc(db, `users/${currentUser.uid}/cart/${item.id}`);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const data = existing.data();
    const newQty = (data.qty || 0) + (item.qty || 1);
    await setDoc(ref, { ...item, qty: newQty }, { merge: true });
  } else {
    await setDoc(ref, { ...item, qty: item.qty || 1 }, { merge: true });
  }
}

// Remove single doc
async function removeFromCartFirestore(id) {
  if (!currentUser) return;
  const ref = doc(db, `users/${currentUser.uid}/cart/${id}`);
  await deleteDoc(ref);
}

// Update icon using realtime snapshot (recommended)
async function updateCartIconRealtime() {
  const cartBtn = document.querySelector("a[href='cart.html']");
  if (!currentUser || !cartBtn) {
    if (cartBtn) cartBtn.textContent = "🛒";
    return;
  }
  const col = collection(db, `users/${currentUser.uid}/cart`);
  // attach snapshot, will update when cart changes
  onSnapshot(col, (snap) => {
    const total = snap.docs.reduce((sum, d) => sum + ((d.data().qty) || 0), 0);
    cartBtn.textContent = total > 0 ? `🛒 (${total})` : "🛒";
  }, (err) => {
    console.warn("cart snapshot error", err);
  });
}

/* ========= Update card quantity after modal changes ========= */
async function updateCardQuantity(kelasId) {
  const card = document.querySelector(`.kelas-card[data-id="${kelasId}"]`);
  if (!card) return;
  
  const iconContainer = card.querySelector(".icon-btn");
  if (!iconContainer) return;
  
  // Get the product data from the card
  const product = {
    id: kelasId,
    title: card.querySelector("h4")?.textContent || "Kelas",
    price: parseInt(card.dataset.price) || 0,
    image: card.querySelector("img")?.src || "assets/placeholder.png",
    type: card.dataset.type || "kelas"
  };
  
  await renderCartControl(iconContainer, product);
}

/* ========= render cart control (per card) ========= */
async function renderCartControl(container, product) {
  // if not logged in show "Tambah ke Keranjang" button that prompts login
  if (!currentUser) {
    container.innerHTML = `<button class="add-cart-btn">+ Tambah ke Keranjang</button>`;
    container.querySelector(".add-cart-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      showLoginModal("Silakan login terlebih dahulu untuk menambahkan ke keranjang.");
    });
    return;
  }

  // check firestore for this item
  const snap = await getDocs(collection(db, `users/${currentUser.uid}/cart`));
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const item = docs.find(d => d.id === product.id);

  if (!item) {
    // Show "Tambah ke Keranjang" button when not in cart
    container.innerHTML = `<button class="add-cart-btn">+ Tambah ke Keranjang</button>`;
    const addBtn = container.querySelector(".add-cart-btn");
    addBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await addToCartFirestore({ ...product, qty: 1 });
      await renderCartControl(container, product);
    });
  } else {
    // Show quantity controls when in cart
    // For kelas/webinar, max qty is 1 - disable + button
    const isMaxQty = item.qty >= 1;
    container.innerHTML = `
      <div class="card-qty-control">
        <button class="qty-btn minus-btn">−</button>
        <span class="qty-value">${item.qty}</span>
        <button class="qty-btn plus-btn" ${isMaxQty ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>+</button>
      </div>
    `;
    const minus = container.querySelector(".minus-btn");
    const plus = container.querySelector(".plus-btn");

    minus.addEventListener("click", async (e) => {
      e.stopPropagation();
      const newQty = (item.qty || 1) - 1;
      if (newQty <= 0) {
        // Remove from cart directly (no confirmation)
        await removeFromCartFirestore(product.id);
      } else {
        const ref = doc(db, `users/${currentUser.uid}/cart/${product.id}`);
        await setDoc(ref, { ...product, qty: newQty }, { merge: true });
      }
      await renderCartControl(container, product);
    });

    // Only allow + if not at max (1 for kelas/webinar)
    if (!isMaxQty) {
      plus.addEventListener("click", async (e) => {
        e.stopPropagation();
        // For kelas/webinar, max is 1 - this shouldn't be reached but just in case
        if ((item.qty || 0) >= 1) return;
        const ref = doc(db, `users/${currentUser.uid}/cart/${product.id}`);
        await setDoc(ref, { ...product, qty: (item.qty || 0) + 1 }, { merge: true });
        await renderCartControl(container, product);
      });
    }
  }
}

/* ========= load kelas (products) ========= */
async function loadKelas() {
  const container = document.getElementById("courses");
  if (!container) return console.warn("#courses container not found");

  container.innerHTML = `<p style="text-align:center;color:#6b7280;">Memuat data...</p>`;

  try {
    const querySnapshot = await getDocs(collection(db, "kelas"));
    container.innerHTML = "";

    if (querySnapshot.empty) {
      container.innerHTML = `<p style="text-align:center;color:#6b7280;">Belum ada kelas tersedia.</p>`;
      return;
    }

    // reset master list
    allCards = [];

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const price = Number(data.price || 0);
      const product = {
        id: docSnap.id,
        title: data.title,
        price: price,
        image: data.imageUrl || data.image || "assets/placeholder.png",
        type: (data.type || "kelas").toLowerCase(),
        description: data.description || ''
      };

      const card = document.createElement("div");
      card.className = "kelas-card";
      card.dataset.id = product.id;
      card.dataset.price = price;
      card.dataset.date = data.date || ""; // expect ISO date if available
      card.dataset.type = product.type;
      card.dataset.description = product.description.toLowerCase();

      card.innerHTML = `
        <div class="image-container">
          <img src="${product.image}" alt="${product.title}">
          <span class="label">${product.type || 'kelas'}</span>
        </div>
        <div class="kelas-info">
          <h4>${product.title}</h4>
          <div class="kelas-footer">
            <div class="price">${formatRupiah(price)}</div>
            <div class="icon-btn"></div>
          </div>
          <button class="buy-btn">Beli Langsung</button>
        </div>
      `;

      const iconContainer = card.querySelector(".icon-btn");
      // render cart controls (reads from Firestore)
      await renderCartControl(iconContainer, product);

      // buy direct (don't persist to cart; save a temp selectedClass and redirect)
      card.querySelector(".buy-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        // Check if user is logged in
        if (!currentUser) {
          showLoginModal("Silakan login terlebih dahulu untuk melanjutkan pembelian.");
          return;
        }
        localStorage.setItem("selectedClass", JSON.stringify(product));
        localStorage.removeItem("resumingOrderId");
        localStorage.removeItem("paymentStartTime");
        window.location.href = "payment.html";
      });

      // push ke master array (tidak langsung append ke DOM)
      allCards.push(card);
    }

    // sekarang render dari master list (apply filter/sort/search)
    applyFiltersAndSort();


  } catch (err) {
    console.error("❌ Gagal memuat data kelas:", err);
    container.innerHTML = `<p style="text-align:center;color:red;">Gagal memuat data kelas.</p>`;
  }
}

/* ========= helper: apply filters, search and sort ========= */
function applyFiltersAndSort() {
  const parent = document.getElementById('courses');
  if (!parent) {
    console.warn("#courses not found");
    return;
  }

  // gunakan salinan master list sebagai sumber (jangan mutate allCards)
  let cards = allCards.slice();

  // Filter: check type and search query (title + description + type)
  cards = cards.filter(card => {
    const type = (card.dataset.type || '').toLowerCase().trim();
    const title = (card.querySelector('h4')?.textContent || '').toLowerCase().trim();
    const desc = (card.dataset.description || '').toLowerCase().trim();

    // type filter
    if (currentFilter && currentFilter !== 'all' && type !== (currentFilter || '').toLowerCase().trim()) {
      return false;
    }

    // search query (if any) - check title/desc/type
    if (currentQuery && currentQuery.length > 0) {
      return title.includes(currentQuery) || desc.includes(currentQuery) || type.includes(currentQuery);
    }

    return true;
  });

  // Sort
  if (currentSort && currentSort !== '') {
    switch (currentSort) {
      case 'price-asc':
        cards.sort((a, b) => Number(a.dataset.price || 0) - Number(b.dataset.price || 0));
        break;
      case 'price-desc':
        cards.sort((a, b) => Number(b.dataset.price || 0) - Number(a.dataset.price || 0));
        break;
      case 'name':
        cards.sort((a, b) => (a.querySelector('h4')?.textContent || '').localeCompare(b.querySelector('h4')?.textContent || ''));
        break;
      case 'date-near':
        cards.sort((a, b) => new Date(a.dataset.date || 0) - new Date(b.dataset.date || 0));
        break;
      case 'date-far':
        cards.sort((a, b) => new Date(b.dataset.date || 0) - new Date(a.dataset.date || 0));
        break;
    }
  }

  // re-render results or show message if nothing
  parent.innerHTML = '';
  if (cards.length === 0) {
    parent.innerHTML = `<p style="text-align:center;color:#6b7280;">Tidak ada kelas yang cocok.</p>`;
    return;
  }
  cards.forEach(c => parent.appendChild(c));
}


/* ========= auth state ========= */
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    console.log("✅ Logged in:", user.email);
    // realtime icon listener
    updateCartIconRealtime();
  } else {
    console.log("🚫 User logged out");
    const cartBtn = document.querySelector("a[href='cart.html']");
    if (cartBtn) cartBtn.textContent = "🛒";
  }
});

/* ========= init ========= */
loadKelas();

// ===== MODAL DETAIL KELAS =====

// Element references (guard in case modal not on page)
const modal = document.getElementById("kelasModal");
const closeBtn = modal?.querySelector(".close-modal");
const modalImg = document.getElementById("modalImage");
const modalTitle = document.getElementById("modalTitle");
const modalDesc = document.getElementById("modalDescription");
const modalPrice = document.getElementById("modalPrice");
const cartQty = document.getElementById("cartQty");
const btnAddCart = document.getElementById("modalAddCart");
const btnBuyNow = document.getElementById("modalBuyNow");

// New quantity control elements
const addCartContainer = document.getElementById("addCartContainer");
const qtyControlsContainer = document.getElementById("qtyControlsContainer");
const modalQtyMinus = document.getElementById("modalQtyMinus");
const modalQtyPlus = document.getElementById("modalQtyPlus");
const modalQtyValue = document.getElementById("modalQtyValue");

// Current modal data
let currentModalKelas = null;
let currentModalQty = 0;

// Open modal for a specific class
async function openKelasModal(kelasId) {
  if (!modal) return;
  try {
    modal.classList.remove("hidden");
    modalImg.src = "assets/placeholder.png";
    modalImg.alt = "Loading...";
    modalTitle.textContent = "Memuat...";
    modalDesc.textContent = "";
    modalPrice.textContent = "";
    cartQty.textContent = "";

    const docRef = doc(db, "kelas", kelasId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      modalTitle.textContent = "Kelas tidak ditemukan";
      return;
    }

    const data = snap.data();
    modalImg.src = data.imageUrl || data.image || "assets/placeholder.png";
    modalImg.alt = data.title || "Kelas";
    modalTitle.textContent = data.title;
    modalDesc.textContent = data.description || "(Belum ada deskripsi)";
    modalPrice.textContent = "Rp " + Number(data.price || 0).toLocaleString("id-ID");

    // Store current kelas data
    currentModalKelas = {
      id: kelasId,
      title: data.title || "Kelas",
      image: data.imageUrl || data.image || "assets/placeholder.png",
      price: data.price || 0,
      type: data.type || "kelas"
    };

    // Cek jumlah di keranjang user and show appropriate controls
    const user = auth.currentUser;
    if (user) {
      const cartRef = doc(db, `users/${user.uid}/cart/${kelasId}`);
      const cartSnap = await getDoc(cartRef);
      if (cartSnap.exists()) {
        const { qty = 1 } = cartSnap.data();
        currentModalQty = qty;
        cartQty.textContent = `🛒 ${qty} dalam keranjang`;
        
        // Show quantity controls, hide add button
        if (addCartContainer) addCartContainer.style.display = "none";
        if (qtyControlsContainer) qtyControlsContainer.style.display = "block";
        if (modalQtyValue) modalQtyValue.textContent = qty;
        
        // For kelas/webinar, max qty is 1 - disable + button
        if (modalQtyPlus) {
          if (qty >= 1) {
            modalQtyPlus.disabled = true;
            modalQtyPlus.style.opacity = "0.4";
            modalQtyPlus.style.cursor = "not-allowed";
          } else {
            modalQtyPlus.disabled = false;
            modalQtyPlus.style.opacity = "1";
            modalQtyPlus.style.cursor = "pointer";
          }
        }
      } else {
        currentModalQty = 0;
        cartQty.textContent = "🛒 Belum ada di keranjang";
        
        // Show add button, hide quantity controls
        if (addCartContainer) addCartContainer.style.display = "block";
        if (qtyControlsContainer) qtyControlsContainer.style.display = "none";
      }
    } else {
      currentModalQty = 0;
      cartQty.textContent = "🛒 (Login untuk menambah)";
      
      // Show add button for non-logged in users
      if (addCartContainer) addCartContainer.style.display = "block";
      if (qtyControlsContainer) qtyControlsContainer.style.display = "none";
    }

    // Tambah ke keranjang (first time add)
    if (btnAddCart) {
      btnAddCart.onclick = async () => {
        if (!auth.currentUser) {
          showLoginModal("Silakan login terlebih dahulu untuk menambahkan ke keranjang.");
          return;
        }
        
        try {
          const cartRef = doc(db, `users/${auth.currentUser.uid}/cart/${kelasId}`);
          
          await setDoc(cartRef, {
            id: kelasId,
            title: data.title || "Kelas",
            image: data.imageUrl || data.image || "assets/placeholder.png",
            price: data.price || 0,
            type: data.type || "kelas",
            qty: 1
          });
          
          currentModalQty = 1;
          cartQty.textContent = `🛒 1 dalam keranjang`;
          
          // Switch to quantity controls
          if (addCartContainer) addCartContainer.style.display = "none";
          if (qtyControlsContainer) qtyControlsContainer.style.display = "block";
          if (modalQtyValue) modalQtyValue.textContent = "1";
          
          console.log("✅ Added to cart:", kelasId, "qty: 1");
          
          // Update the kelas card quantity display
          await updateCardQuantity(kelasId);
        } catch (err) {
          console.error("❌ Failed to add to cart:", err);
          showErrorToast("Gagal menambahkan ke keranjang. Silakan coba lagi.");
        }
      };
    }
    
    // Plus button - increase quantity (max 1 for kelas/webinar)
    if (modalQtyPlus) {
      modalQtyPlus.onclick = async () => {
        if (!auth.currentUser || !currentModalKelas) return;
        
        // For kelas/webinar, max qty is 1
        if (currentModalQty >= 1) {
          console.log("⚠️ Max quantity (1) reached for kelas/webinar");
          return;
        }
        
        try {
          const newQty = currentModalQty + 1;
          const cartRef = doc(db, `users/${auth.currentUser.uid}/cart/${currentModalKelas.id}`);
          
          await setDoc(cartRef, {
            ...currentModalKelas,
            qty: newQty
          });
          
          currentModalQty = newQty;
          if (modalQtyValue) modalQtyValue.textContent = newQty;
          cartQty.textContent = `🛒 ${newQty} dalam keranjang`;
          console.log("✅ Quantity updated:", currentModalKelas.id, "qty:", newQty);
          
          // Disable + button if at max (1)
          if (newQty >= 1) {
            modalQtyPlus.disabled = true;
            modalQtyPlus.style.opacity = "0.4";
            modalQtyPlus.style.cursor = "not-allowed";
          }
          
          // Update the kelas card quantity display
          await updateCardQuantity(kelasId);
        } catch (err) {
          console.error("❌ Failed to update quantity:", err);
        }
      };
    }
    
    // Minus button - decrease quantity or remove
    if (modalQtyMinus) {
      modalQtyMinus.onclick = async () => {
        if (!auth.currentUser || !currentModalKelas) return;
        
        try {
          const cartRef = doc(db, `users/${auth.currentUser.uid}/cart/${currentModalKelas.id}`);
          
          if (currentModalQty <= 1) {
            // Remove from cart directly (no confirmation)
            await deleteDoc(cartRef);
            
            currentModalQty = 0;
            cartQty.textContent = "🛒 Belum ada di keranjang";
            
            // Switch back to add button
            if (addCartContainer) addCartContainer.style.display = "block";
            if (qtyControlsContainer) qtyControlsContainer.style.display = "none";
            
            console.log("✅ Removed from cart:", currentModalKelas.id);
          } else {
            // Decrease quantity
            const newQty = currentModalQty - 1;
            
            await setDoc(cartRef, {
              ...currentModalKelas,
              qty: newQty
            });
            
            currentModalQty = newQty;
            if (modalQtyValue) modalQtyValue.textContent = newQty;
            cartQty.textContent = `🛒 ${newQty} dalam keranjang`;
            console.log("✅ Quantity updated:", currentModalKelas.id, "qty:", newQty);
          }
          
          // Update the kelas card quantity display
          await updateCardQuantity(kelasId);
        } catch (err) {
          console.error("❌ Failed to update quantity:", err);
        }
      };
    }

    // Beli langsung
    if (btnBuyNow) {
      btnBuyNow.onclick = () => {
        // Check if user is logged in
        if (!auth.currentUser) {
          showLoginModal("Silakan login terlebih dahulu untuk melanjutkan pembelian.");
          return;
        }
        const selected = {
          id: kelasId,
          title: data.title || "Kelas",
          image: data.imageUrl || data.image || "assets/placeholder.png",
          price: data.price || 0,
          type: data.type || "kelas",
          qty: 1,
        };
        localStorage.setItem("selectedClass", JSON.stringify(selected));
        // Clear stale data
        localStorage.removeItem("cartCheckoutItems");
        localStorage.removeItem("resumingOrderId");
        localStorage.removeItem("paymentStartTime");
        window.location.href = "payment.html";
      };
    }

  } catch (err) {
    console.error("❌ Gagal memuat detail kelas:", err);
    modalTitle.textContent = "Terjadi kesalahan memuat kelas.";
  }
}

// Close modal
if (closeBtn) closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
if (modal) modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.add("hidden");
});

// Attach modal open to each class card (setelah render)
document.addEventListener("click", (e) => {
  const card = e.target.closest(".kelas-card");
  if (card && card.dataset.id) {
    openKelasModal(card.dataset.id);
  }
});

// ===== SEARCH / FILTER / SORT UI wiring =====
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const sortSelect = document.getElementById("sortSelect");
const filterButtons = document.querySelectorAll(".filter-btn");

// normalize helpers
const norm = s => (s || '').toString().toLowerCase().trim();

function onSearchChange() {
  currentQuery = norm(searchInput?.value || '');
  applyFiltersAndSort();
}

if (searchInput) searchInput.addEventListener('input', onSearchChange);
if (searchBtn) searchBtn.addEventListener('click', (e) => { e.preventDefault(); onSearchChange(); });

if (sortSelect) {
  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value || '';
    applyFiltersAndSort();
  });
}

filterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    filterButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // normalize the filter value immediately
    currentFilter = norm(btn.dataset.filter || 'all') || 'all';
    applyFiltersAndSort();
  });
});
