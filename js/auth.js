// js/auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showSuccessToast, showErrorToast } from './ui-utils.js';

// 🔥 Konfigurasi Firebase project kamu
const firebaseConfig = {
  apiKey: "AIzaSyBMJX0eWB1gUyvBUzeUSYt05XX-lD33-js",
  authDomain: "sejalan-884bc.firebaseapp.com",
  projectId: "sejalan-884bc",
  storageBucket: "sejalan-884bc.firebasestorage.app",
  messagingSenderId: "768730225727",
  appId: "1:768730225727:web:fbb9dcef53b8ea1f0a2c8a"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Check for register success message (shown on login page after successful registration)
if (sessionStorage.getItem("registerSuccess")) {
  sessionStorage.removeItem("registerSuccess");
  setTimeout(() => {
    showSuccessToast("Akun berhasil dibuat! Silakan login.", 4000);
  }, 300);
}

// === REGISTER ===
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("registerName").value;
    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    const registerError = document.getElementById("registerError");
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.classList.add("loading");
    submitBtn.innerHTML = '<span class="spinner"></span> Mendaftar...';
    if (registerError) registerError.textContent = "";

    try {
      // Buat akun
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update display name di profil auth
      await updateProfile(user, { displayName: name });

      // Simpan ke Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: name,
        email: email,
        role: "user",
        createdAt: serverTimestamp()
      });

      // Store success message for login page
      sessionStorage.setItem("registerSuccess", "true");
      window.location.href = "login.html";
    } catch (err) {
      console.error(err);
      if (registerError) registerError.textContent = err.message;
      // Reset button state
      submitBtn.disabled = false;
      submitBtn.classList.remove("loading");
      submitBtn.textContent = originalText;
    }
  });
}

// === LOGIN ===
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.classList.add("loading");
    submitBtn.innerHTML = '<span class="spinner"></span> Memproses...';
    document.getElementById("loginError").textContent = "";

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      localStorage.setItem("user", JSON.stringify({
        uid: user.uid,
        name: user.displayName,
        email: user.email
      }));
      // Store login success message for the next page
      sessionStorage.setItem("loginSuccess", user.displayName || user.email);
      window.location.href = "index.html"; // redirect ke halaman utama
    } catch (err) {
      document.getElementById("loginError").textContent = "Email atau password salah.";
      // Reset button state
      submitBtn.disabled = false;
      submitBtn.classList.remove("loading");
      submitBtn.textContent = originalText;
    }
  });
}

// --- Google Login ---
const googleBtn = document.getElementById("googleLoginBtn");
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    const originalHTML = googleBtn.innerHTML;
    
    // Show loading state
    googleBtn.disabled = true;
    googleBtn.classList.add("loading");
    googleBtn.innerHTML = '<span class="spinner"></span> Menghubungkan...';
    
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      // Store login success message for the next page
      sessionStorage.setItem("loginSuccess", user.displayName || user.email);
      window.location.href = "index.html"; // redirect setelah login
    } catch (error) {
      console.error("Login dengan Google gagal:", error);
      showErrorToast("Gagal login dengan Google. Silakan coba lagi.");
      // Reset button state
      googleBtn.disabled = false;
      googleBtn.classList.remove("loading");
      googleBtn.innerHTML = originalHTML;
    }
  });
}

// === CEK STATUS LOGIN ===
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("User login:", user.email);
  } else {
    console.log("Belum login");
  }
});

// === LOGOUT ===
window.logout = async function() {
  await signOut(auth);
  localStorage.removeItem("user");
  alert("Berhasil logout");
  window.location.href = "login.html";
};
