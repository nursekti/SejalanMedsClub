// js/forgot-password.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBMJX0eWB1gUyvBUzeUSYt05XX-lD33-js",
  authDomain: "sejalan-884bc.firebaseapp.com",
  projectId: "sejalan-884bc",
  storageBucket: "sejalan-884bc.firebasestorage.app",
  messagingSenderId: "768730225727",
  appId: "1:768730225727:web:fbb9dcef53b8ea1f0a2c8a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Elements
const resetForm = document.getElementById("resetForm");
const resetEmail = document.getElementById("resetEmail");
const resetBtn = document.getElementById("resetBtn");
const resetError = document.getElementById("resetError");
const successMessage = document.getElementById("successMessage");

// Handle form submit
if (resetForm) {
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = resetEmail.value.trim();
    
    if (!email) {
      resetError.textContent = "Silakan masukkan email Anda.";
      return;
    }
    
    // Show loading state
    resetBtn.classList.add("loading-btn");
    resetBtn.textContent = "Mengirim...";
    resetError.textContent = "";
    
    try {
      await sendPasswordResetEmail(auth, email);
      
      // Show success message
      successMessage.classList.add("show");
      resetForm.style.display = "none";
      resetError.textContent = "";
      
      console.log("✅ Password reset email sent to:", email);
      
    } catch (error) {
      console.error("❌ Error sending reset email:", error);
      
      // Handle specific error codes
      let errorMessage = "Terjadi kesalahan. Silakan coba lagi.";
      
      switch (error.code) {
        case "auth/user-not-found":
          errorMessage = "Email tidak terdaftar. Silakan periksa kembali atau daftar akun baru.";
          break;
        case "auth/invalid-email":
          errorMessage = "Format email tidak valid.";
          break;
        case "auth/too-many-requests":
          errorMessage = "Terlalu banyak permintaan. Silakan coba lagi dalam beberapa menit.";
          break;
        case "auth/network-request-failed":
          errorMessage = "Koneksi internet bermasalah. Silakan periksa jaringan Anda.";
          break;
      }
      
      resetError.textContent = errorMessage;
      
    } finally {
      // Reset button state
      resetBtn.classList.remove("loading-btn");
      resetBtn.textContent = "Kirim Link Reset Password";
    }
  });
}

