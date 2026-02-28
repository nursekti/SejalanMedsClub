// js/profile.js
console.log("👤 profile.js loaded");

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

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

// DOM Elements
const nameEl = document.getElementById("profileName");
const emailEl = document.getElementById("profileEmail");
const phoneEl = document.getElementById("profilePhone");
const profileForm = document.getElementById("profileForm");
const nameError = document.getElementById("nameError");
const profileMessage = document.getElementById("profileMessage");
const logoutBtn = document.getElementById("logoutBtn");
const logoutBtnDropdown = document.getElementById("logoutBtnDropdown");

let currentUser = null;

// === HELPER: Get default name from user ===
function getDefaultName(user) {
  // Priority: displayName > email username > "User"
  if (user.displayName && user.displayName.trim() !== "") {
    return user.displayName;
  }
  
  if (user.email) {
    // Extract name from email (before @)
    return user.email.split("@")[0];
  }
  
  return "User";
}

// === SHOW MESSAGE ===
function showMessage(text, isSuccess = true) {
  profileMessage.textContent = text;
  profileMessage.style.display = "block";
  profileMessage.style.background = isSuccess ? "#d1fae5" : "#fef2f2";
  profileMessage.style.color = isSuccess ? "#059669" : "#ef4444";
  profileMessage.style.border = `1px solid ${isSuccess ? "#a7f3d0" : "#fecaca"}`;
  
  // Auto hide after 4 seconds
  setTimeout(() => {
    profileMessage.style.display = "none";
  }, 4000);
}

// === LOAD PROFILE FROM FIRESTORE ===
async function loadProfile(userId) {
  try {
    const profileRef = doc(db, `users/${userId}/profile`, "info");
    const profileSnap = await getDoc(profileRef);
    
    if (profileSnap.exists()) {
      const data = profileSnap.data();
      nameEl.value = data.name || getDefaultName(currentUser);
      emailEl.value = data.email || currentUser.email || "";
      phoneEl.value = data.phone || "";
      console.log("✅ Profile loaded from Firestore");
    } else {
      // No profile in Firestore, use defaults from auth
      nameEl.value = getDefaultName(currentUser);
      emailEl.value = currentUser.email || "";
      phoneEl.value = "";
      console.log("ℹ️ No profile in Firestore, using auth defaults");
      
      // Auto-save default profile for new users
      await saveProfile(userId, {
        name: nameEl.value,
        email: emailEl.value,
        phone: ""
      }, true);
    }
  } catch (err) {
    console.error("❌ Failed to load profile:", err);
    // Fallback to auth data
    nameEl.value = getDefaultName(currentUser);
    emailEl.value = currentUser.email || "";
    phoneEl.value = "";
  }
}

// === SAVE PROFILE TO FIRESTORE ===
async function saveProfile(userId, data, silent = false) {
  try {
    const profileRef = doc(db, `users/${userId}/profile`, "info");
    await setDoc(profileRef, {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    // Also update Firebase Auth displayName
    if (currentUser && data.name) {
      await updateProfile(currentUser, {
        displayName: data.name
      });
    }
    
    console.log("✅ Profile saved to Firestore");
    if (!silent) {
      showMessage("✅ Profil berhasil disimpan!", true);
    }
    return true;
  } catch (err) {
    console.error("❌ Failed to save profile:", err);
    if (!silent) {
      showMessage("❌ Gagal menyimpan profil. Silakan coba lagi.", false);
    }
    return false;
  }
}

// === FORM SUBMIT HANDLER ===
profileForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  // Validate name
  const name = nameEl.value.trim();
  if (!name) {
    nameError.style.display = "block";
    nameEl.focus();
    return;
  }
  nameError.style.display = "none";
  
  if (!currentUser) {
    showMessage("❌ Anda belum login!", false);
    return;
  }
  
  // Disable button while saving
  const saveBtn = document.getElementById("saveProfileBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "⏳ Menyimpan...";
  
  const profileData = {
    name: name,
    email: emailEl.value.trim(),
    phone: phoneEl.value.trim()
  };
  
  await saveProfile(currentUser.uid, profileData);
  
  // Re-enable button
  saveBtn.disabled = false;
  saveBtn.textContent = "💾 Simpan Profil";
});

// === CLEAR ERROR ON INPUT ===
nameEl?.addEventListener("input", () => {
  if (nameEl.value.trim()) {
    nameError.style.display = "none";
  }
});

// === AUTH STATE ===
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
  } else {
    currentUser = user;
    console.log("✅ User logged in:", user.email);
    loadProfile(user.uid);
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

