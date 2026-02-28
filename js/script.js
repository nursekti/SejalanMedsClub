// Tombol "Gabung Sekarang" → scroll ke section #courses
document.getElementById('joinBtn').addEventListener('click', function () {
    window.location.href = '#courses';
  });
  
  // Search
const searchInput = document.getElementById("searchInput");
const kelasList = document.getElementById("kelasList");

searchInput?.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase();
  document.querySelectorAll("#kelasList .card").forEach(card => {
    const title = card.querySelector("h2").textContent.toLowerCase();
    card.style.display = title.includes(query) ? "block" : "none";
  });
});

// Sorting
document.getElementById("sortSelect")?.addEventListener("change", (e) => {
    const sortValue = e.target.value;
    const cards = Array.from(document.querySelectorAll("#courses .course-card"));
    const parent = document.getElementById("courses");
  
    let sorted = [...cards]; // copy array
  
    switch (sortValue) {
      case "price-asc":
        sorted.sort((a, b) => Number(a.dataset.price) - Number(b.dataset.price));
        break;
      case "price-desc":
        sorted.sort((a, b) => Number(b.dataset.price) - Number(a.dataset.price));
        break;
      case "name":
        sorted.sort((a, b) =>
          a.querySelector("h4").textContent.localeCompare(b.querySelector("h4").textContent)
        );
        break;
      case "date-near":
        sorted.sort((a, b) => new Date(a.dataset.date) - new Date(b.dataset.date));
        break;
      case "date-far":
        sorted.sort((a, b) => new Date(b.dataset.date) - new Date(a.dataset.date));
        break;
    }
  
    // Kosongkan container & append hasil sorting
    parent.innerHTML = "";
    sorted.forEach(card => parent.appendChild(card));
  });
  

// === FILTER BUTTONS Class & Webinar===
const filterButtons = document.querySelectorAll(".filter-btn");
const kelasCards = document.querySelectorAll("#courses .course-card");

filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    // hapus .active dari semua tombol
    filterButtons.forEach(b => b.classList.remove("active"));
    // tambahin .active ke tombol yg dipilih
    btn.classList.add("active");

    const filter = btn.dataset.filter; // all / kelas / webinar

    kelasCards.forEach(card => {
        if (filter === "all" || card.dataset.type === filter) {
          card.classList.remove("hidden");
        } else {
          card.classList.add("hidden");
        }
      });
      
  });
});

// === FILTER BUTTONS Shop ===
const filterButtonsShop = document.querySelectorAll(".filter-btn");
const productCards = document.querySelectorAll(".products .product");

filterButtonsShop.forEach(btn => {
  btn.addEventListener("click", () => {
    // hapus .active dari semua tombol
    filterButtonsShop.forEach(b => b.classList.remove("active"));
    // tambahin .active ke tombol yg dipilih
    btn.classList.add("active");

    const filter = btn.dataset.filter; // all / book / clothes / equipment

    productCards.forEach(card => {
      if (filter === "all" || card.dataset.type === filter) {
        card.classList.remove("hidden");
      } else {
        card.classList.add("hidden");
      }
    });
  });
});
