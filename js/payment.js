// js/payment.js
console.log("💳 payment.js loaded (with discount logic + loading state + Firebase fix)");

// === Firebase setup ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
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

window.currentUser = null;
onAuthStateChanged(auth, (user) => (window.currentUser = user || null));

// === UTIL ===
function formatRupiah(num) {
  if (!num && num !== 0) return "Rp 0";
  return "Rp " + Number(num || 0).toLocaleString("id-ID");
}

// === SHIPPING COST LOGIC ===
// Solo Raya postal codes (Rp 20.000), others (Rp 30.000)
const soloRayaPostalCodes = [
  // Surakarta
  "57111","57112","57113","57114","57115","57116","57117","57118","57119",
  // Sukoharjo
  "57511","57512","57513","57514","57515","57516","57517","57518","57519",
  // Karanganyar
  "57711","57712","57713","57714","57715","57716","57717",
  // Boyolali
  "57311","57312","57313","57314","57315","57316",
  // Sragen
  "57211","57212","57213","57214","57215","57216",
  // Wonogiri
  "57611","57612","57613","57614","57615",
  // Klaten
  "57411","57412","57413","57414","57415","57416"
];

function getShippingCost(postalCode) {
  const code = (postalCode || '').toString().trim();
  if (soloRayaPostalCodes.includes(code)) {
    return 20000; // Rp 20.000 for Solo Raya
  }
  return 30000; // Rp 30.000 for other areas
}

let currentShippingCost = 0; // Track current shipping cost

// === LOADING STATE ===
const orderDetailsEl = document.getElementById("orderDetails");
if (orderDetailsEl) {
  orderDetailsEl.innerHTML = `
    <div style="text-align:center;padding:24px;color:#6b7280">
      <div class="spinner" style="margin-bottom:8px;">⏳</div>
      <p>Sedang memuat ringkasan pembelian...</p>
    </div>
  `;
}

let currentItems = []; // simpan untuk diskon re-render

// === CHECK IF ITEMS INCLUDE KELAS/WEBINAR ===
function hasKelasOrWebinar(items) {
  if (!items || items.length === 0) return false;
  const kelasTypes = ['kelas', 'webinar'];
  return items.some(item => {
    const itemType = (item.type || '').toLowerCase().trim();
    return kelasTypes.includes(itemType);
  });
}

// === CHECK IF ITEMS INCLUDE PHYSICAL PRODUCTS (SHOP ITEMS) ===
function hasPhysicalProducts(items) {
  if (!items || items.length === 0) return false;
  // Digital types that don't need shipping
  const digitalTypes = ['kelas', 'webinar'];
  
  return items.some(item => {
    const itemType = (item.type || '').toLowerCase().trim();
    // It's a physical product if it's NOT a digital type (kelas/webinar)
    const isPhysical = !digitalTypes.includes(itemType);
    console.log("💳 [PAYMENT] Checking item:", item.title, "type:", itemType, "isPhysical:", isPhysical);
    return isPhysical;
  });
}

// === SHOW/HIDE PROMO SECTION ===
function updatePromoSectionVisibility(items) {
  const promoSection = document.getElementById('promoSection');
  const instagramInput = document.getElementById('instagramAccount');
  const discountRadios = document.querySelectorAll('input[name="discount"]');
  
  if (!promoSection) return;
  
  const showPromo = hasKelasOrWebinar(items);
  console.log("💳 [PAYMENT] Show promo section:", showPromo);
  
  if (showPromo) {
    promoSection.style.display = 'block';
    // Make fields required when visible
    if (instagramInput) instagramInput.required = true;
    discountRadios.forEach(r => r.required = true);
  } else {
    promoSection.style.display = 'none';
    // Remove required when hidden
    if (instagramInput) instagramInput.required = false;
    discountRadios.forEach(r => r.required = false);
  }
}

// === SHOW/HIDE ADDRESS FIELDS (for shop items only) ===
function updateAddressFieldsVisibility(items) {
  const addressContainer = document.getElementById('addressFieldsContainer');
  const alamatInput = document.getElementById('alamatLengkap');
  const kodePosInput = document.getElementById('kodePos');
  
  if (!addressContainer) return;
  
  const showAddress = hasPhysicalProducts(items);
  console.log("💳 [PAYMENT] Show address fields:", showAddress);
  
  if (showAddress) {
    addressContainer.style.display = 'block';
    // Make fields required when visible
    if (alamatInput) alamatInput.required = true;
    if (kodePosInput) kodePosInput.required = true;
  } else {
    addressContainer.style.display = 'none';
    // Remove required when hidden
    if (alamatInput) alamatInput.required = false;
    if (kodePosInput) kodePosInput.required = false;
  }
}

// === SHOW/HIDE SHIPPING SECTION (based on Kode Pos filled) ===
function updateShippingSectionVisibility(items) {
  const shippingSection = document.getElementById('shippingSection');
  const shippingRadios = document.querySelectorAll('input[name="shipping"]');
  const kodePosInput = document.getElementById('kodePos');
  
  if (!shippingSection) return;
  
  const isPhysical = hasPhysicalProducts(items);
  const kodePosFilled = kodePosInput && kodePosInput.value.trim().length === 5;
  const showShipping = isPhysical && kodePosFilled;
  
  console.log("💳 [PAYMENT] Show shipping section:", showShipping, "(isPhysical:", isPhysical, ", kodePosFilled:", kodePosFilled, ")");
  
  if (showShipping) {
    shippingSection.style.display = 'block';
    // Make shipping selection required when visible
    shippingRadios.forEach(r => r.required = true);
  } else {
    shippingSection.style.display = 'none';
    // Remove required when hidden
    shippingRadios.forEach(r => r.required = false);
  }
}

// === RENDER SUMMARY (with optional discount) ===
function renderSummary(items, applyDiscount = false) {
  console.log("💳 [PAYMENT] renderSummary called with items:", items);
  
  // Update section visibility based on item types
  updatePromoSectionVisibility(items);
  updateAddressFieldsVisibility(items);
  updateShippingSectionVisibility(items);
  
  const out = document.getElementById("orderDetails");
  if (!out) return;
  if (!items || items.length === 0) {
    out.innerHTML = "<p>Keranjang kosong.</p>";
    return;
  }

  let total = 0;
  const listHTML = items.map(item => {
    console.log("💳 [PAYMENT] Processing item:", item);
    console.log("💳 [PAYMENT] hasNameTag:", item.hasNameTag, "type:", typeof item.hasNameTag);
    const qty = Number(item.qty) || 1;
    const price = Number(item.price) || 0;
    const subtotal = qty * price;
    total += subtotal;
    const title = item.title || item.name || item.kelas || "(Tanpa Nama)";
    if(item.hasNameTag === true) {
      console.log("💳 [PAYMENT] ✅ hasNameTag is TRUE - showing name tag input");
      const numTagsPerItem = Number(item.numOfNametag) || 1;
      // Total name tags = numOfNametag per item × quantity purchased
      const numTags = numTagsPerItem * qty;
      console.log("💳 [PAYMENT] numOfNametag per item:", numTagsPerItem, "× qty:", qty, "= total:", numTags);
      
      // Generate multiple name tag inputs based on numOfNametag
      // Include data-item-id to associate name tags with specific items
      const itemId = item.id || title.replace(/\s+/g, '_');
      let nameTagInputs = '';
      for (let i = 1; i <= numTags; i++) {
        nameTagInputs += `
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
            <label><small>Nama Tag ${numTags > 1 ? i : ''}:</small></label>
            <input type="text" name="nameTag_${itemId}_${i}" class="name-tag-input" data-item-id="${itemId}" 
              placeholder="Masukkan nama untuk tag${numTags > 1 ? ' ' + i : ''}" 
              style="width:200px;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;" required>
          </div>`;
      }
      
      return `
      <div class="summary-item" style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid #eee;">
        <div style="max-width:70%;">
          <strong>${title}</strong><br>
          <small>${qty} × ${formatRupiah(price)}</small>
          ${nameTagInputs}
        </div>
        <div><strong>${formatRupiah(subtotal)}</strong></div>
      </div>
    `;
    } else {
      console.log("💳 [PAYMENT] ❌ hasNameTag is FALSE or not true - hiding name tag input");
      return `
      <div class="summary-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee;">
        <div style="max-width:70%;">
          <strong>${title}</strong><br>
          <small>${qty} × ${formatRupiah(price)}</small>
        </div>
        <div><strong>${formatRupiah(subtotal)}</strong></div>
      </div>
    `;
    }
  }).join("");

  if (applyDiscount) total -= 5000;

  // Check shipping cost
  const shippingSelected = document.querySelector('input[name="shipping"]:checked');
  const postalCodeInput = document.getElementById('kodePos');
  const postalCode = postalCodeInput ? postalCodeInput.value.trim() : '';
  
  let shippingHTML = '';
  if (shippingSelected && shippingSelected.value === 'ship' && hasPhysicalProducts(items)) {
    currentShippingCost = getShippingCost(postalCode);
    total += currentShippingCost;
    const isSoloRaya = soloRayaPostalCodes.includes(postalCode);
    shippingHTML = `
      <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;color:#0369a1;">
        <span>Ongkir ${isSoloRaya ? '(Solo Raya)' : '(Luar Kota)'}</span>
        <strong>+ ${formatRupiah(currentShippingCost)}</strong>
      </div>
    `;
  } else {
    currentShippingCost = 0;
  }

  out.innerHTML = `
    <div class="order-summary">
      <div>${listHTML}</div>
      ${applyDiscount ? `
        <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;color:green;">
          <span>Diskon Repost Story</span>
          <strong>- ${formatRupiah(5000)}</strong>
        </div>
      ` : ""}
      ${shippingHTML}
      <div style="margin-top:10px;font-weight:700;display:flex;justify-content:space-between;border-top:2px solid #e5e7eb;padding-top:10px;">
        <span>Total</span>
        <span>${formatRupiah(total)}</span>
      </div>
    </div>
  `;
}

// 🔁 Gunakan data pendingPayment saat kembali dari confirmPayment
const pendingPayment = JSON.parse(localStorage.getItem("pendingPayment") || "null");
if (pendingPayment && pendingPayment.items) {
  console.log("🔄 Using pendingPayment data (back navigation detected)");
  renderSummary(pendingPayment.items, false);
  currentItems = pendingPayment.items;
} else {
  console.log("ℹ️ No pendingPayment found, loading normal checkout flow...");
}

// === LOAD PAYMENT DATA ===
async function loadPaymentData() {
  await new Promise(r => setTimeout(r, 500));

  const selected = JSON.parse(localStorage.getItem("selectedClass") || "null");
  const cartCheckoutItems = JSON.parse(localStorage.getItem("cartCheckoutItems") || "null");
  const cartItems = JSON.parse(localStorage.getItem("cartItems") || "[]");

  console.log("💳 [PAYMENT] loadPaymentData() called");
  console.log("💳 [PAYMENT] selectedClass from localStorage:", selected);
  console.log("💳 [PAYMENT] cartCheckoutItems from localStorage:", cartCheckoutItems);
  console.log("💳 [PAYMENT] cartItems from localStorage:", cartItems);

  if (selected) {
    console.log("💳 [PAYMENT] Using selectedClass - hasNameTag:", selected.hasNameTag);
    currentItems = [{ ...selected, qty: selected.qty || 1 }];
  } else if (Array.isArray(cartCheckoutItems) && cartCheckoutItems.length > 0) {
    console.log("💳 [PAYMENT] Using cartCheckoutItems");
    currentItems = cartCheckoutItems;
  } else if (Array.isArray(cartItems) && cartItems.length > 0) {
    console.log("💳 [PAYMENT] Using cartItems");
    currentItems = cartItems;
  } else {
    console.log("💳 [PAYMENT] No payment data found!");
    document.getElementById("orderDetails").innerHTML = "<p>Tidak ada data pembayaran.</p>";
    return;
  }

  console.log("💳 [PAYMENT] Final currentItems:", currentItems);
  renderSummary(currentItems);
}

if (!pendingPayment || !pendingPayment.items) {
  loadPaymentData();
}

// === BACK NAVIGATION CLEANUP ===
window.addEventListener("pageshow", (e) => {
  try {
    const nav = performance.getEntriesByType("navigation")[0];
    if (e.persisted || (nav && nav.type === "back_forward")) {
      localStorage.removeItem("selectedClass");
    }
  } catch {}
});

// === Dropdown logic (Universitas + Angkatan) ===
// (dibiarkan sama seperti punyamu)
const universities = [
  "Universitas Abdurrab Riau","Universitas Abulyatama","Universitas Airlangga","Universitas Al-Khairat Palu","Universitas Andalas",
  "Universitas Baiturrahmah","Universitas Batam","Universitas Bengkulu","Universitas Bosowa","Universitas Brawijaya",
  "Universitas Cenderawasih","Universitas Ciputra","Universitas Diponegoro","Universitas Gadjah Mada","Universitas Gunadarma",
  "Universitas Haluoleo","Universitas Hang Tuah","Universitas Hasanuddin","Universitas HKBP Nomennsen Medan","Universitas Indonesia",
  "Universitas Islam Al Azhar Mataram","Universitas Islam Bandung","Universitas Islam Indonesia","Universitas Islam Malang",
  "Universitas Islam Negeri Alauddin Makassar","Universitas Islam Negeri Syarif Hidayatullah Jakarta",
  "Universitas Islam Negeri Maulana Malik Ibrahim Malang","Universitas Islam Sultan Agung","Universitas Islam Sumatera Utara",
  "Universitas Jambi","Universitas Jember","Universitas Jenderal Achmad Yani","Universitas Jenderal Soedirman",
  "Universitas Katolik Atma Jaya","Universitas Katolik Widya Mandala Surabaya","Universitas Khairun Ternate",
  "Universitas Kristen Duta Wacana","Universitas Kristen Indonesia","Universitas Kristen Krida Wacana","Universitas Kristen Maranatha",
  "Universitas Lambung Mangkurat","Universitas Lampung","Universitas Malahayati","Universitas Malikussaleh Aceh",
  "Universitas Mataram","Universitas Methodist Indonesia","Universitas Muhammadiyah Jakarta","Universitas Muhammadiyah Makassar",
  "Universitas Muhammadiyah Malang","Universitas Muhammadiyah Palembang","Universitas Muhammadiyah Purwokerto",
  "Universitas Muhammadiyah Prof. Dr. Hamka","Universitas Muhammadiyah Semarang","Universitas Muhammadiyah Sumatera Utara",
  "Universitas Muhammadiyah Surabaya","Universitas Muhammadiyah Surakarta","Universitas Muhammadiyah Yogyakarta","Universitas Mulawarman",
  "Universitas Muslim Indonesia","Universitas Nahdlatul Ulama Surabaya","Universitas Nusa Cendana Kupang","Universitas Padjajaran",
  "Universitas Palangkaraya","Universitas Papua","Universitas Pattimura","Universitas Pelita Harapan",
  "Universitas Pembangunan Nasional Veteran Jakarta","Universitas Pendidikan Ganesha","Universitas Prima Indonesia",
  "Universitas Riau","Universitas Sam Ratulangi","Universitas Sebelas Maret","Universitas Sriwijaya","Universitas Sumatera Utara",
  "Universitas Surabaya","Universitas Swadaya Gunung Jati Cirebon","Universitas Syiah Kuala","Universitas Tadulako Palu",
  "Universitas Tanjungpura Pontianak","Universitas Tarumanagara","Universitas Trisakti","Universitas Udayana",
  "Universitas Wahid Hasyim","Universitas Warmadewa","Universitas Wijaya Kusuma Surabaya","Universitas Yarsi",
  "Poltekkes Kemenkes Jakarta 1","Other"
];
const inputUniversity = document.getElementById("universitySearch");
const listUniversity = document.getElementById("universityList");
const otherUniversityContainer = document.getElementById("otherUniversityContainer");
const otherUniversityInput = document.getElementById("otherUniversityInput");

function renderListUniversity(filtered = universities) {
  listUniversity.innerHTML = "";
  filtered.forEach(u => {
    const li = document.createElement("li");
    li.textContent = u;
    li.addEventListener("click", () => selectUniversity(u));
    listUniversity.appendChild(li);
  });
}
function selectUniversity(name) {
  inputUniversity.value = name;
  listUniversity.classList.remove("show", "up");
  if (name === "Other" || name.startsWith("Other")) {
    otherUniversityContainer.style.display = "block";
    otherUniversityInput.required = true;
  } else {
    otherUniversityContainer.style.display = "none";
    otherUniversityInput.required = false;
  }
}
function showDropdownUniversity() {
  const rect = inputUniversity.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  listUniversity.classList.add("show");
  if (spaceBelow < 250) listUniversity.classList.add("up");
  else listUniversity.classList.remove("up");
}
inputUniversity.addEventListener("input", () => {
  const val = inputUniversity.value.toLowerCase().trim();
  const filtered = universities.filter(u => u.toLowerCase().includes(val));
  if (filtered.length === 0 && val !== "") {
    renderListUniversity([`Other (isi manual)`]);
  } else {
    renderListUniversity(filtered);
  }
  showDropdownUniversity();
});
inputUniversity.addEventListener("focus", showDropdownUniversity);
document.addEventListener("click", (e) => {
  if (!e.target.closest("#universityDropdown")) {
    listUniversity.classList.remove("show", "up");
  }
});
renderListUniversity();

// Angkatan
const angkatan = ["2020","2021","2022","2023","Other"];
const inputAngkatan = document.getElementById("angkatanSearch");
const listAngkatan = document.getElementById("angkatanList");
const otherAngkatanContainer = document.getElementById("otherAngkatanContainer");
const otherAngkatanInput = document.getElementById("otherAngkatanInput");
function renderListAngkatan(filtered = angkatan) {
  listAngkatan.innerHTML = "";
  filtered.forEach(u => {
    const li = document.createElement("li");
    li.textContent = u;
    li.addEventListener("click", () => selectAngkatan(u));
    listAngkatan.appendChild(li);
  });
}
function selectAngkatan(name) {
  inputAngkatan.value = name;
  listAngkatan.classList.remove("show", "up");
  if (name === "Other" || name.startsWith("Other")) {
    otherAngkatanContainer.style.display = "block";
    otherAngkatanInput.required = true;
  } else {
    otherAngkatanContainer.style.display = "none";
    otherAngkatanInput.required = false;
  }
}
function showDropdownAngkatan() {
  const rect = inputAngkatan.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  listAngkatan.classList.add("show");
  if (spaceBelow < 250) listAngkatan.classList.add("up");
  else listAngkatan.classList.remove("up");
}
inputAngkatan.addEventListener("input", () => {
  const val = inputAngkatan.value.toLowerCase().trim();
  const filtered = angkatan.filter(u => u.toLowerCase().includes(val));
  if (filtered.length === 0 && val !== "") {
    renderListAngkatan([`Other (isi manual)`]);
  } else {
    renderListAngkatan(filtered);
  }
  showDropdownAngkatan();
});
inputAngkatan.addEventListener("focus", showDropdownAngkatan);
document.addEventListener("click", (e) => {
  if (!e.target.closest("#angkatanDropdown")) {
    listAngkatan.classList.remove("show", "up");
  }
});
renderListAngkatan();

// === Diskon dan Upload Proof ===
const discountRadios = document.querySelectorAll('input[name="discount"]');
const proofContainer = document.getElementById('proofUploadContainer');
const proofInput = document.getElementById('proofUpload');
const proofPreview = document.getElementById('proofPreview');

function updateDiscountDisplay() {
  const withDiscount = document.querySelector('input[value="withDiscount"]').checked;
  const hasProof = proofInput.files.length > 0;
  renderSummary(currentItems, withDiscount && hasProof);
}

discountRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.value === 'withDiscount' && radio.checked) {
      proofContainer.style.display = 'block';
      proofInput.required = true;
    } else {
      proofContainer.style.display = 'none';
      proofInput.required = false;
      proofInput.value = '';
      proofPreview.innerHTML = '';
    }
    updateDiscountDisplay();
  });
});

proofInput?.addEventListener('change', () => {
  const file = proofInput.files[0];
  proofPreview.innerHTML = '';
  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    alert("Ukuran file maksimal 10MB!");
    proofInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    proofPreview.innerHTML = `<img src="${e.target.result}" style="max-width:150px;margin-top:8px;border-radius:8px;">`;
  };
  reader.readAsDataURL(file);
  updateDiscountDisplay();
});

// === SHIPPING COST LISTENERS ===
const shippingRadios = document.querySelectorAll('input[name="shipping"]');
const postalCodeInput = document.getElementById('kodePos');

function updateShippingDisplay() {
  // Re-render summary to update shipping cost
  const withDiscount = document.querySelector('input[value="withDiscount"]')?.checked || false;
  const hasProof = proofInput?.files?.length > 0 || false;
  renderSummary(currentItems, withDiscount && hasProof);
}

// Listen for shipping method change
shippingRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    console.log("💳 [PAYMENT] Shipping method changed:", radio.value);
    updateShippingDisplay();
  });
});

// Listen for postal code change
postalCodeInput?.addEventListener('input', () => {
  const code = postalCodeInput.value.trim();
  
  // Show/hide shipping section based on postal code length
  updateShippingSectionVisibility(currentItems);
  
  if (code.length === 5) {
    console.log("💳 [PAYMENT] Postal code entered:", code);
    const isSoloRaya = soloRayaPostalCodes.includes(code);
    console.log("💳 [PAYMENT] Is Solo Raya:", isSoloRaya, "Shipping cost:", isSoloRaya ? "Rp 20.000" : "Rp 30.000");
    updateShippingDisplay();
  }
});

// Also update when postal code loses focus
postalCodeInput?.addEventListener('blur', () => {
  updateShippingSectionVisibility(currentItems);
  updateShippingDisplay();
});

// === SUBMIT PAYMENT ===
document.getElementById("paymentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const method = document.querySelector('input[name="method"]:checked')?.value;
  if (!method) {
    alert("Pilih metode pembayaran terlebih dahulu.");
    return;
  }

  const cartCheckoutItems = JSON.parse(localStorage.getItem("cartCheckoutItems") || "null");
  const cartItems = JSON.parse(localStorage.getItem("cartItems") || "[]");
  const selected = JSON.parse(localStorage.getItem("selectedClass") || "null");
  let items;

  if (selected) items = [{ ...selected, qty: selected.qty || 1 }];
  else if (Array.isArray(cartCheckoutItems) && cartCheckoutItems.length > 0) items = cartCheckoutItems;
  else if (Array.isArray(cartItems) && cartItems.length > 0) items = cartItems;
  else {
    alert("Tidak ada item untuk dibayar.");
    return;
  }

  const discountApplied = document.querySelector('input[name="discount"][value="withDiscount"]')?.checked || false;
  let total = items.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
  if (discountApplied) total -= 5000;
  
  // Add shipping cost if applicable
  const shippingMethod = document.querySelector('input[name="shipping"]:checked')?.value;
  let shippingCost = 0;
  if (shippingMethod === 'ship' && hasPhysicalProducts(items)) {
    const postalCode = document.getElementById('kodePos')?.value.trim() || '';
    shippingCost = getShippingCost(postalCode);
    total += shippingCost;
  }

  // Clear any stale data from previous incomplete purchases
  // This ensures new purchases start fresh (not resuming old orders)
  localStorage.removeItem("resumingOrderId");
  localStorage.removeItem("paymentStartTime");
  
  // Capture customer information from form
  const formInputs = paymentForm.querySelectorAll('input[type="text"], input[type="tel"], textarea');
  const namaLengkap = formInputs[0]?.value.trim() || "";
  const nomorHP = formInputs[1]?.value.trim() || "";
  const universitas = document.getElementById('universitySearch')?.value.trim() || "";
  const otherUniversity = document.getElementById('otherUniversityInput')?.value.trim() || "";
  const angkatan = document.getElementById('angkatanSearch')?.value.trim() || "";
  const otherAngkatan = document.getElementById('otherAngkatanInput')?.value.trim() || "";
  const alamatLengkap = document.getElementById('alamatLengkap')?.value.trim() || "";
  const kodePos = document.getElementById('kodePos')?.value.trim() || "";
  const instagramAccount = document.getElementById('instagramAccount')?.value.trim() || "";
  
  // Use "other" values if selected
  const finalUniversitas = universitas === "Lainnya" ? otherUniversity : universitas;
  const finalAngkatan = angkatan === "Lainnya" ? otherAngkatan : angkatan;
  
  // Capture name tags from the form, grouped by item ID
  const nameTagInputs = document.querySelectorAll('.name-tag-input');
  const nameTagsByItem = {}; // { itemId: ["name1", "name2"], ... }
  
  nameTagInputs.forEach(input => {
    if (input.value.trim()) {
      const itemId = input.dataset.itemId;
      if (!nameTagsByItem[itemId]) {
        nameTagsByItem[itemId] = [];
      }
      nameTagsByItem[itemId].push(input.value.trim());
    }
  });
  console.log("💳 [PAYMENT] Name tags by item:", nameTagsByItem);
  
  // Attach name tags to corresponding items
  items.forEach(item => {
    const itemId = item.id || (item.title || item.name || item.kelas || "").replace(/\s+/g, '_');
    if (nameTagsByItem[itemId]) {
      item.nameTags = nameTagsByItem[itemId].join(", ");
    } else {
      item.nameTags = "";
    }
  });
  console.log("💳 [PAYMENT] Items with name tags:", items);
  
  // Also collect all name tags for backward compatibility
  const allNameTags = Object.values(nameTagsByItem).flat();
  console.log("💳 [PAYMENT] All name tags:", allNameTags);
  
  // Capture Instagram proof image (for discount)
  let instagramProof = null;
  const proofUploadInput = document.getElementById('proofUpload');
  if (proofUploadInput && proofUploadInput.files && proofUploadInput.files[0]) {
    try {
      const file = proofUploadInput.files[0];
      instagramProof = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      console.log("📸 [PAYMENT] Instagram proof captured");
    } catch (err) {
      console.error("❌ [PAYMENT] Failed to read Instagram proof:", err);
    }
  }
  
  // Check if discount was applied
  const discountAppliedRadio = document.querySelector('input[name="discount"][value="withDiscount"]');
  const hasDiscount = discountAppliedRadio?.checked || false;
  
  // Customer info object
  const customerInfo = {
    namaLengkap,
    nomorHP,
    universitas: finalUniversitas,
    angkatan: finalAngkatan,
    alamatLengkap,
    kodePos,
    instagramAccount,
    nameTags: allNameTags.length > 0 ? allNameTags.join(", ") : "",
    hasDiscount: hasDiscount,
    instagramProof: instagramProof
  };
  
  // Simpan ke localStorage sebelum redirect
  localStorage.setItem("pendingPayment", JSON.stringify({ 
    items, 
    total, 
    method,
    shippingMethod: shippingMethod || null,
    shippingCost: shippingCost,
    customerInfo
  }));

  // Redirect ke halaman konfirmasi
  window.location.href = `confirmPayment.html?method=${method}`;
});

