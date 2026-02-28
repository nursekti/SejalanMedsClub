import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { showSuccessToast, showErrorToast } from './ui-utils.js';

// 🔧 Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBMJX0eWB1gUyvBUzeUSYt05XX-lD33-js",
  authDomain: "sejalan-884bc.firebaseapp.com",
  projectId: "sejalan-884bc",
  storageBucket: "sejalan-884bc.firebasestorage.app",
  messagingSenderId: "768730225727",
  appId: "1:768730225727:web:fbb9dcef53b8ea1f0a2c8a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.classList.add("loading");
    submitBtn.innerHTML = '<span class="spinner"></span> Mendaftar...';

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      // Store success message for login page
      sessionStorage.setItem("registerSuccess", "true");
      window.location.href = "login.html";
    } catch (err) {
      showErrorToast("Gagal daftar: " + err.message);
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
      // Store login success for index page
      sessionStorage.setItem("loginSuccess", user.displayName || user.email);
      window.location.href = "index.html";
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