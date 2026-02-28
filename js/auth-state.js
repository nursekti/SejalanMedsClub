// js/auth-state.js (dengan cache 1 jam)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showSuccessToast } from './ui-utils.js';

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
const auth = getAuth(app);
const db = getFirestore(app);

const headerEl = document.querySelector("header");
const loginBtn = document.getElementById("loginBtn");
const userMenu = document.getElementById("userMenu");
const usernameDisplay = document.getElementById("usernameDisplay");
const dropdownMenu = document.getElementById("dropdownMenu");
const logoutBtn = document.getElementById("logoutBtn");

function getCachedUser() {
  const cached = localStorage.getItem("userCache");
  if (!cached) return null;
  try {
    const data = JSON.parse(cached);
    const age = Date.now() - data.timestamp;
    if (age > 3600 * 1000) { // > 1 jam => clear
      localStorage.removeItem("userCache");
      return null;
    }
    return data.user;
  } catch { return null; }
}
function setCachedUser(user) {
  if (!user) {
    localStorage.removeItem("userCache");
    return;
  }
  localStorage.setItem("userCache", JSON.stringify({ user, timestamp: Date.now() }));
}

// show header asap if cache exists
const cachedUser = getCachedUser();
if (cachedUser) {
  loginBtn?.classList.add("hidden");
  userMenu?.classList.remove("hidden");
  usernameDisplay.textContent = cachedUser.displayName || cachedUser.email.split("@")[0];
  headerEl?.classList.add("ready"); // show header immediately
} else {
  // if no cache, still add ready quickly so UI doesn't feel blocked
  setTimeout(() => headerEl?.classList.add("ready"), 80);
}

// Check for login success message (shown after successful login redirect)
const loginSuccessName = sessionStorage.getItem("loginSuccess");
if (loginSuccessName) {
  sessionStorage.removeItem("loginSuccess");
  setTimeout(() => {
    showSuccessToast(`Selamat datang, ${loginSuccessName}!`, 3500);
  }, 500);
}

// Track header cart subscription
let headerCartUnsubscribe = null;

onAuthStateChanged(auth, (user) => {
  // Clean up previous subscription
  if (headerCartUnsubscribe) {
    headerCartUnsubscribe();
    headerCartUnsubscribe = null;
  }
  
  const cartBtn = document.querySelector("a[href='cart.html']");
  
  if (user) {
    const udata = { uid: user.uid, email: user.email, displayName: user.displayName || user.email.split("@")[0] };
    setCachedUser(udata);
    loginBtn?.classList.add("hidden");
    userMenu?.classList.remove("hidden");
    usernameDisplay.textContent = udata.displayName;
    
    // Update header cart count in real-time
    if (cartBtn) {
      const cartCollection = collection(db, `users/${user.uid}/cart`);
      headerCartUnsubscribe = onSnapshot(cartCollection, (snapshot) => {
        const totalItems = snapshot.docs.reduce((sum, doc) => sum + (doc.data().qty || 1), 0);
        cartBtn.textContent = totalItems > 0 ? `🛒 (${totalItems})` : "🛒";
      }, (err) => {
        console.warn("Header cart snapshot error:", err);
        cartBtn.textContent = "🛒";
      });
    }
  } else {
    setCachedUser(null);
    loginBtn?.classList.remove("hidden");
    userMenu?.classList.add("hidden");
    if (cartBtn) cartBtn.textContent = "🛒";
  }
  headerEl?.classList.add("ready");
});

usernameDisplay?.addEventListener("click", () => {
  dropdownMenu.classList.toggle("hidden");
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  setCachedUser(null);
  window.location.href = "index.html";
});

export function getActiveUser() {
  return getCachedUser();
}

// === FLOATING CART ICON ===
// Only show on pages that are NOT cart, payment, profile, or history
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
const excludedPages = ['cart.html', 'payment.html', 'confirmPayment.html', 'profile.html', 'history.html'];
const shouldShowFloatingCart = !excludedPages.includes(currentPage);

console.log('🛒 [FLOATING CART] Current page:', currentPage);
console.log('🛒 [FLOATING CART] Should show:', shouldShowFloatingCart);

if (shouldShowFloatingCart) {
  // Create floating cart element
  const floatingCart = document.createElement('div');
  floatingCart.id = 'floatingCart';
  floatingCart.innerHTML = `
    <span class="cart-icon">🛒</span>
    <span class="cart-count" id="floatingCartCount">0</span>
  `;
  floatingCart.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 75px;
    height: 75px;
    background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%);
    border-radius: 50%;
    display: none;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(26, 35, 126, 0.4);
    z-index: 9999;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  `;
  
  // Add styles for inner elements
  const style = document.createElement('style');
  style.textContent = `
    #floatingCart:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 25px rgba(26, 35, 126, 0.5);
    }
    #floatingCart .cart-icon {
      font-size: 24px;
      filter: grayscale(1) brightness(10);
    }
    #floatingCart .cart-count {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #e91e63;
      color: white;
      font-size: 12px;
      font-weight: 700;
      min-width: 22px;
      height: 22px;
      border-radius: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 6px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(floatingCart);
  
  // Function to adjust floating cart position to stay above footer
  function adjustFloatingCartPosition() {
    const footer = document.querySelector('.footer, footer');
    if (!footer || !floatingCart) return;
    
    const footerRect = footer.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const cartHeight = 75; // height of floating cart
    const minBottomSpace = 24; // minimum space from bottom
    
    // Check if footer is visible in viewport
    if (footerRect.top < windowHeight) {
      // Footer is visible - position cart above footer
      const newBottom = windowHeight - footerRect.top + minBottomSpace;
      floatingCart.style.bottom = `${newBottom}px`;
    } else {
      // Footer not visible - reset to default position
      floatingCart.style.bottom = '24px';
    }
  }
  
  // Adjust position on scroll and resize
  window.addEventListener('scroll', adjustFloatingCartPosition, { passive: true });
  window.addEventListener('resize', adjustFloatingCartPosition, { passive: true });
  // Initial adjustment
  setTimeout(adjustFloatingCartPosition, 100);
  
  // Click handler - redirect to cart
  floatingCart.addEventListener('click', () => {
    window.location.href = 'cart.html';
  });
  
  // Subscribe to cart changes when user is logged in
  let unsubscribeCart = null;
  
  onAuthStateChanged(auth, (user) => {
    // Cleanup previous subscription
    if (unsubscribeCart) {
      unsubscribeCart();
      unsubscribeCart = null;
    }
    
    if (user) {
      console.log('🛒 [FLOATING CART] User logged in, subscribing to cart:', user.uid);
      const cartCollection = collection(db, `users/${user.uid}/cart`);
      unsubscribeCart = onSnapshot(cartCollection, (snapshot) => {
        const totalItems = snapshot.docs.reduce((sum, doc) => sum + (doc.data().qty || 1), 0);
        console.log('🛒 [FLOATING CART] Cart items count:', totalItems);
        const countEl = document.getElementById('floatingCartCount');
        
        if (totalItems > 0) {
          console.log('🛒 [FLOATING CART] Showing floating cart');
          floatingCart.style.display = 'flex';
          if (countEl) countEl.textContent = totalItems > 99 ? '99+' : totalItems;
        } else {
          console.log('🛒 [FLOATING CART] Hiding floating cart (empty)');
          floatingCart.style.display = 'none';
        }
      }, (err) => {
        console.error('🛒 [FLOATING CART] Snapshot error:', err);
        floatingCart.style.display = 'none';
      });
    } else {
      // User logged out - hide floating cart
      floatingCart.style.display = 'none';
    }
  });
}
