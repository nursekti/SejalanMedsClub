// home.js - Fetches and displays ongoing kelas and top products on home page
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { showLoginModal } from './ui-utils.js';

// Firebase configuration - same as auth-state.js
const firebaseConfig = {
  apiKey: "AIzaSyBMJX0eWB1gUyvBUzeUSYt05XX-lD33-js",
  authDomain: "sejalan-884bc.firebaseapp.com",
  projectId: "sejalan-884bc",
  storageBucket: "sejalan-884bc.firebasestorage.app",
  messagingSenderId: "768730225727",
  appId: "1:768730225727:web:fbb9dcef53b8ea1f0a2c8a",
  measurementId: "G-E522147QHB"
};

// Initialize Firebase - reuse existing app if already initialized
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Store loaded items for modal access
let loadedKelas = [];
let loadedProducts = [];

// Modal elements
const modal = document.getElementById("homeModal");
const closeBtn = modal?.querySelector(".close-modal");
const modalImg = document.getElementById("homeModalImage");
const modalTitle = document.getElementById("homeModalTitle");
const modalDesc = document.getElementById("homeModalDescription");
const modalPrice = document.getElementById("homeModalPrice");
const modalBadge = document.getElementById("homeModalBadge");
const btnBuyNow = document.getElementById("homeModalBuyNow");

// Current modal state
let currentModalItem = null;

// Format price to Indonesian Rupiah
function formatPrice(price) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(price);
}

// Render Kelas Card
function renderKelasCard(kelas) {
  return `
    <article class="home-card kelas-card" data-id="${kelas.id}" data-type="kelas">
      <div class="home-card-image">
        <img src="${kelas.imageUrl || kelas.image || 'assets/placeholder.png'}" alt="${kelas.title || 'Kelas'}" onerror="this.src='assets/placeholder.png'">
        ${kelas.type ? `<span class="card-badge">${kelas.type}</span>` : ''}
      </div>
      <div class="home-card-content">
        <h4>${kelas.title || 'Untitled Class'}</h4>
        <p class="card-desc">${kelas.description || ''}</p>
        <div class="card-footer">
          <span class="card-price">${formatPrice(kelas.price || 0)}</span>
        </div>
        <button class="home-buy-btn" data-id="${kelas.id}" data-type="kelas">Beli Sekarang</button>
      </div>
    </article>
  `;
}

// Render Product Card
function renderProductCard(product) {
  return `
    <article class="home-card product-card" data-id="${product.id}" data-type="product">
      <div class="home-card-image">
        <img src="${product.imageUrl || product.image || 'assets/placeholder.png'}" alt="${product.title || 'Produk'}" onerror="this.src='assets/placeholder.png'">
        ${product.category ? `<span class="card-badge">${product.category}</span>` : ''}
      </div>
      <div class="home-card-content">
        <h4>${product.title || product.name || 'Untitled Product'}</h4>
        <p class="card-desc">${product.description || ''}</p>
        <div class="card-footer">
          <span class="card-price">${formatPrice(product.price || 0)}</span>
        </div>
        <button class="home-buy-btn" data-id="${product.id}" data-type="product">Beli Sekarang</button>
      </div>
    </article>
  `;
}

// Render empty state
function renderEmptyState(message) {
  return `
    <div class="empty-state">
      <div class="empty-icon">📭</div>
      <p>${message}</p>
    </div>
  `;
}

// Load Ongoing Kelas from Firebase
async function loadOngoingKelas() {
  const grid = document.getElementById('ongoingKelasGrid');
  if (!grid) return;

  try {
    const ongoingRef = collection(db, 'ongoingKelas');
    const snapshot = await getDocs(ongoingRef);
    
    if (snapshot.empty) {
      grid.innerHTML = renderEmptyState('Belum ada kelas yang sedang berlangsung');
      return;
    }

    loadedKelas = [];
    let html = '';
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const item = { id: docSnap.id, ...data };
      loadedKelas.push(item);
      html += renderKelasCard(item);
    });
    
    grid.innerHTML = html;
    attachCardListeners(grid);

  } catch (error) {
    console.error('Error loading ongoing kelas:', error);
    grid.innerHTML = renderEmptyState('Gagal memuat kelas');
  }
}

// Load Top Products from Firebase
async function loadTopProducts() {
  const grid = document.getElementById('topProductGrid');
  if (!grid) return;

  try {
    const topProductRef = collection(db, 'topProduct');
    const snapshot = await getDocs(topProductRef);
    
    if (snapshot.empty) {
      grid.innerHTML = renderEmptyState('Belum ada produk terlaris');
      return;
    }

    loadedProducts = [];
    let html = '';
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const item = { id: docSnap.id, ...data };
      loadedProducts.push(item);
      html += renderProductCard(item);
    });
    
    grid.innerHTML = html;
    attachCardListeners(grid);

  } catch (error) {
    console.error('Error loading top products:', error);
    grid.innerHTML = renderEmptyState('Gagal memuat produk');
  }
}

// Attach click listeners to cards
function attachCardListeners(container) {
  // Card click - open modal
  container.querySelectorAll('.home-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't open modal if clicking on button
      if (e.target.closest('.home-buy-btn')) return;
      
      const id = card.dataset.id;
      const type = card.dataset.type;
      openModal(id, type);
    });
  });

  // Buy button click - direct buy
  container.querySelectorAll('.home-buy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const type = btn.dataset.type;
      handleBuyNow(id, type);
    });
  });
}

// Find item by ID and type
function findItem(id, type) {
  if (type === 'kelas') {
    return loadedKelas.find(k => k.id === id);
  } else {
    return loadedProducts.find(p => p.id === id);
  }
}

// Open modal for item
function openModal(id, type) {
  if (!modal) return;

  const item = findItem(id, type);
  if (!item) {
    console.error('Item not found:', id, type);
    return;
  }

  modal.classList.remove('hidden');
  
  // Set modal content
  modalImg.src = item.imageUrl || item.image || 'assets/placeholder.png';
  modalImg.alt = item.title || 'Item';
  modalTitle.textContent = item.title || item.name || 'Untitled';
  modalDesc.textContent = item.description || '(Belum ada deskripsi)';
  modalPrice.textContent = formatPrice(item.price || 0);
  
  // Set badge
  if (modalBadge) {
    const badgeText = type === 'kelas' ? (item.type || 'Kelas') : (item.category || 'Produk');
    modalBadge.textContent = badgeText;
    modalBadge.style.display = 'inline-block';
  }

  // Store current item for buy now
  currentModalItem = {
    id: item.id,
    title: item.title || item.name || 'Item',
    image: item.imageUrl || item.image || 'assets/placeholder.png',
    price: item.price || 0,
    type: type === 'kelas' ? (item.type || 'kelas') : 'product',
    description: item.description || '',
    hasNameTag: item.hasNameTag === true,
    numOfNametag: Number(item.numOfNametag) || 0
  };
}

// Handle Buy Now
function handleBuyNow(id, type) {
  const item = findItem(id, type);
  if (!item) return;

  const user = auth.currentUser;
  if (!user) {
    showLoginModal('Silakan login terlebih dahulu untuk melanjutkan pembelian.');
    return;
  }

  // Clear previous data
  localStorage.removeItem("resumingOrderId");
  localStorage.removeItem("paymentStartTime");

  // Prepare item for checkout
  const checkoutItem = {
    id: item.id,
    title: item.title || item.name || 'Item',
    image: item.imageUrl || item.image || 'assets/placeholder.png',
    price: item.price || 0,
    type: type === 'kelas' ? (item.type || 'kelas') : 'product',
    qty: 1,
    hasNameTag: item.hasNameTag === true,
    numOfNametag: Number(item.numOfNametag) || 0
  };

  localStorage.setItem("cartCheckoutItems", JSON.stringify([checkoutItem]));
  window.location.href = "payment.html";
}

// Close modal
function closeModal() {
  if (modal) {
    modal.classList.add('hidden');
  }
  currentModalItem = null;
}

// Event listeners
if (closeBtn) {
  closeBtn.addEventListener('click', closeModal);
}

if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

if (btnBuyNow) {
  btnBuyNow.addEventListener('click', () => {
    if (currentModalItem) {
      handleBuyNow(currentModalItem.id, currentModalItem.type === 'product' ? 'product' : 'kelas');
    }
  });
}

// ESC key to close modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
    closeModal();
  }
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  loadOngoingKelas();
  loadTopProducts();
});
