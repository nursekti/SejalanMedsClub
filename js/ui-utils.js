// js/ui-utils.js
// Shared UI utilities for modals, toasts, and notifications

console.log("🎨 ui-utils.js loaded");

/**
 * Shows a login prompt modal instead of alert
 * @param {string} message - Optional custom message
 */
export function showLoginModal(message = "Silakan login terlebih dahulu untuk melanjutkan.") {
  // Remove existing modal if any
  const existing = document.getElementById('loginPromptModal');
  if (existing) existing.remove();

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'loginPromptModal';
  modal.innerHTML = `
    <div class="login-modal-overlay">
      <div class="login-modal-content">
        <div class="login-modal-icon">🔐</div>
        <h3>Login Diperlukan</h3>
        <p>${message}</p>
        <div class="login-modal-actions">
          <button class="login-modal-btn primary" id="loginModalGoBtn">Masuk / Daftar</button>
          <button class="login-modal-btn secondary" id="loginModalCloseBtn">Nanti Saja</button>
        </div>
      </div>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.id = 'loginModalStyles';
  if (!document.getElementById('loginModalStyles')) {
    style.textContent = `
      .login-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(26, 35, 126, 0.5);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .login-modal-content {
        background: white;
        border-radius: 16px;
        padding: 32px;
        max-width: 360px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(26, 35, 126, 0.3);
        animation: slideUp 0.3s ease;
      }
      .login-modal-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      .login-modal-content h3 {
        margin: 0 0 12px;
        font-size: 20px;
        color: #1a237e;
        font-weight: 700;
      }
      .login-modal-content p {
        margin: 0 0 24px;
        color: #5c6bc0;
        font-size: 14px;
        line-height: 1.5;
      }
      .login-modal-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .login-modal-btn {
        padding: 12px 24px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
      }
      .login-modal-btn.primary {
        background: linear-gradient(135deg, #1a237e 0%, #3949ab 100%);
        color: white;
        box-shadow: 0 4px 15px rgba(26, 35, 126, 0.3);
      }
      .login-modal-btn.primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(26, 35, 126, 0.4);
      }
      .login-modal-btn.secondary {
        background: #f3f4f6;
        color: #5c6bc0;
      }
      .login-modal-btn.secondary:hover {
        background: #e5e7eb;
      }
      @media (max-width: 480px) {
        .login-modal-content {
          padding: 24px 20px;
        }
        .login-modal-icon {
          font-size: 40px;
        }
        .login-modal-content h3 {
          font-size: 18px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(modal);

  // Event handlers
  const goBtn = document.getElementById('loginModalGoBtn');
  const closeBtn = document.getElementById('loginModalCloseBtn');
  const overlay = modal.querySelector('.login-modal-overlay');

  goBtn.addEventListener('click', () => {
    window.location.href = 'login.html';
  });

  closeBtn.addEventListener('click', () => {
    modal.remove();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      modal.remove();
    }
  });
}

/**
 * Shows a success toast notification
 * @param {string} message - Message to display
 * @param {number} duration - Duration in ms (default 3000)
 */
export function showSuccessToast(message, duration = 3000) {
  // Remove existing toast if any
  const existing = document.getElementById('successToast');
  if (existing) existing.remove();

  // Create toast
  const toast = document.createElement('div');
  toast.id = 'successToast';
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">✓</span>
      <span class="toast-message">${message}</span>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.id = 'toastStyles';
  if (!document.getElementById('toastStyles')) {
    style.textContent = `
      #successToast {
        position: fixed;
        top: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10001;
        animation: toastSlideIn 0.4s ease;
      }
      @keyframes toastSlideIn {
        from { 
          opacity: 0; 
          transform: translateX(-50%) translateY(-20px); 
        }
        to { 
          opacity: 1; 
          transform: translateX(-50%) translateY(0); 
        }
      }
      @keyframes toastSlideOut {
        from { 
          opacity: 1; 
          transform: translateX(-50%) translateY(0); 
        }
        to { 
          opacity: 0; 
          transform: translateX(-50%) translateY(-20px); 
        }
      }
      .toast-content {
        display: flex;
        align-items: center;
        gap: 12px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 14px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(16, 185, 129, 0.4);
        font-weight: 500;
        font-size: 15px;
      }
      .toast-icon {
        width: 24px;
        height: 24px;
        background: rgba(255,255,255,0.25);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 700;
      }
      #successToast.hiding {
        animation: toastSlideOut 0.3s ease forwards;
      }
      @media (max-width: 480px) {
        #successToast {
          width: 90%;
          max-width: 320px;
        }
        .toast-content {
          padding: 12px 18px;
          font-size: 14px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // Auto-hide after duration
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

/**
 * Shows an error toast notification
 * @param {string} message - Message to display
 * @param {number} duration - Duration in ms (default 4000)
 */
export function showErrorToast(message, duration = 4000) {
  // Remove existing toast if any
  const existing = document.getElementById('errorToast');
  if (existing) existing.remove();

  // Create toast
  const toast = document.createElement('div');
  toast.id = 'errorToast';
  toast.innerHTML = `
    <div class="error-toast-content">
      <span class="error-toast-icon">✕</span>
      <span class="error-toast-message">${message}</span>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.id = 'errorToastStyles';
  if (!document.getElementById('errorToastStyles')) {
    style.textContent = `
      #errorToast {
        position: fixed;
        top: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10001;
        animation: toastSlideIn 0.4s ease;
      }
      .error-toast-content {
        display: flex;
        align-items: center;
        gap: 12px;
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
        padding: 14px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 30px rgba(239, 68, 68, 0.4);
        font-weight: 500;
        font-size: 15px;
      }
      .error-toast-icon {
        width: 24px;
        height: 24px;
        background: rgba(255,255,255,0.25);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 700;
      }
      #errorToast.hiding {
        animation: toastSlideOut 0.3s ease forwards;
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // Auto-hide after duration
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

// Make functions available globally for non-module scripts
window.showLoginModal = showLoginModal;
window.showSuccessToast = showSuccessToast;
window.showErrorToast = showErrorToast;

