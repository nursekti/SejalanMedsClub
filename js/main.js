import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth();

// elemen
const loginBtn = document.getElementById("loginBtn");
const userMenu = document.getElementById("userMenu");
const usernameDisplay = document.getElementById("usernameDisplay");
const dropdownMenu = document.getElementById("dropdownMenu");
const userDropdownBtn = document.getElementById("userDropdownBtn");
const logoutBtn = document.getElementById("logoutBtn");

// toggle dropdown
userDropdownBtn?.addEventListener("click", () => {
  dropdownMenu.classList.toggle("hidden");
});

// cek apakah user login
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginBtn.classList.add("hidden");
    userMenu.classList.remove("hidden");

    usernameDisplay.textContent = user.displayName || "Akun Saya";
  } else {
    loginBtn.classList.remove("hidden");
    userMenu.classList.add("hidden");
  }
});

// logout
logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});
