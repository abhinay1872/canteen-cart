/**
 * CAMPUS TUCK SHOP & CANTEEN KART
 * Core Application Logic (Modular Vanilla ES6+)
 */

// ---------------------------------------------------------------------------
// 1. SOUND FX CONTROLLER (Web Audio API Synthesizer)
// ---------------------------------------------------------------------------
class SoundController {
  constructor() {
    this.audioCtx = null;
    this.enabled = true;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
  }

  toggleSound() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  playPop() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.audioCtx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.08);
    } catch (e) {
      console.warn("Audio pop error", e);
    }
  }

  playSuccessChime() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const now = this.audioCtx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];

      notes.forEach((freq, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.09);

        gain.gain.setValueAtTime(0, now + i * 0.09);
        gain.gain.linearRampToValueAtTime(0.25, now + i * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.35);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.36);
      });
    } catch (e) {
      console.warn("Audio chime error", e);
    }
  }

  playKitchenBell() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const now = this.audioCtx.currentTime;
      [880, 1760].forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(idx === 0 ? 0.4 : 0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 1.2);
      });
    } catch (e) {
      console.warn("Kitchen bell error", e);
    }
  }

  playPickupReady() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const now = this.audioCtx.currentTime;
      const notes = [659.25, 880.0, 1318.51];

      notes.forEach((freq, i) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);

        gain.gain.setValueAtTime(0.3, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.51);
      });
    } catch (e) {
      console.warn("Pickup ready audio error", e);
    }
  }
}

const sounds = new SoundController();

// ---------------------------------------------------------------------------
// 2. APPLICATION STATE
// ---------------------------------------------------------------------------
const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem('ck_cart') || '[]'),
  orders: [],
  notifications: [],
  activeCustomerOrder: JSON.parse(localStorage.getItem('ck_active_order') || 'null'),
  selectedCategory: 'ALL',
  searchQuery: '',
  isAdmin: false,
  kdsFilter: 'ACTIVE',
  adminMenuSearch: '',
  adminPinBuffer: '',
  kitchenAudioAlert: true,
};

// ---------------------------------------------------------------------------
// 3. TOAST NOTIFICATION UTILITY
// ---------------------------------------------------------------------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'danger') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ---------------------------------------------------------------------------
// 4. API CLIENT
// ---------------------------------------------------------------------------
const api = {
  async getProducts() {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Failed to fetch products');
    return await res.json();
  },

  async updateProduct(id, data) {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update product');
    return await res.json();
  },

  async deleteProduct(id) {
    const res = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete product');
    return await res.json();
  },

  async createProduct(data) {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add product');
    return await res.json();
  },

  async getOrders() {
    const res = await fetch('/api/orders');
    if (!res.ok) throw new Error('Failed to fetch orders');
    return await res.json();
  },

  async createOrder(data) {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to place order');
    }
    return await res.json();
  },

  async patchOrder(orderId, patchData) {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchData),
    });
    if (!res.ok) throw new Error('Failed to update order');
    return await res.json();
  },

  async toggleItemPacked(orderId, itemId, packed = null) {
    const res = await fetch(`/api/orders/${orderId}/items/${itemId}/pack`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: packed !== null ? JSON.stringify({ packed }) : JSON.stringify({}),
    });
    if (!res.ok) throw new Error('Failed to update packing status');
    return await res.json();
  },

  async packAllItems(orderId, packed = true) {
    const res = await fetch(`/api/orders/${orderId}/pack-all`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packed }),
    });
    if (!res.ok) throw new Error('Failed to update packing status');
    return await res.json();
  },

  async getNotifications() {
    const res = await fetch('/api/notifications');
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return await res.json();
  },

  async subscribeNotification(productId, subscriber) {
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, subscriber }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to subscribe');
    }
    return await res.json();
  },

  async sendRestockAlerts(productId) {
    const res = await fetch(`/api/notifications/${productId}/notify`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to send alerts');
    return await res.json();
  },

  async verifyPin(pin) {
    const res = await fetch('/api/admin/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    return await res.json();
  }
};

// ---------------------------------------------------------------------------
// 5. REALTIME WEBSOCKET & DYNAMIC POLLING
// ---------------------------------------------------------------------------
class RealtimeSync {
  constructor() {
    this.ws = null;
    this.pollInterval = null;
    this.reconnectTimeout = null;
  }

  start() {
    this.connectWs();
    this.pollInterval = setInterval(() => {
      this.pollOrdersAndNotifications();
    }, 3000);
  }

  connectWs() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        const ind = document.getElementById('ws-status-text');
        if (ind) ind.textContent = 'Live Sync Active';
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleEvent(data);
        } catch (e) {}
      };

      this.ws.onclose = () => {
        const ind = document.getElementById('ws-status-text');
        if (ind) ind.textContent = 'Reconnecting...';
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => this.connectWs(), 3000);
      };

      this.ws.onerror = () => {
        if (this.ws) this.ws.close();
      };
    } catch (e) {
      console.warn("WebSocket init error", e);
    }
  }

  async pollOrdersAndNotifications() {
    try {
      const [orders, notifications] = await Promise.all([
        api.getOrders(),
        api.getNotifications()
      ]);
      this.checkNewOrderArrival(orders);
      state.orders = orders;
      state.notifications = notifications;

      if (state.isAdmin) {
        renderKdsOrders();
        updateKdsMetrics();
        renderRestockTable();
      }
      this.syncActiveCustomerOrder();
    } catch (e) {}
  }

  checkNewOrderArrival(newOrders) {
    if (!state.orders || state.orders.length === 0) return;
    const knownIds = new Set(state.orders.map(o => o.order_id));
    const freshOrders = newOrders.filter(o => !knownIds.has(o.order_id));

    if (freshOrders.length > 0) {
      if (state.isAdmin && state.kitchenAudioAlert) {
        sounds.playKitchenBell();
      }
      freshOrders.forEach(o => {
        if (state.isAdmin) {
          showToast(`🔔 New Order #${o.token} from ${o.customer_name}!`, 'info');
        }
      });
    }
  }

  handleEvent(data) {
    if (data.type === 'NEW_ORDER') {
      const exists = state.orders.some(o => o.order_id === data.order.order_id);
      if (!exists) {
        state.orders.unshift(data.order);
        if (state.isAdmin) {
          if (state.kitchenAudioAlert) sounds.playKitchenBell();
          showToast(`🔔 New Order #${data.order.token} from ${data.order.customer_name}!`, 'info');
          renderKdsOrders();
          updateKdsMetrics();
        }
      }
    } else if (data.type === 'ORDER_UPDATED') {
      const idx = state.orders.findIndex(o => o.order_id === data.order.order_id);
      if (idx !== -1) {
        state.orders[idx] = data.order;
      } else {
        state.orders.unshift(data.order);
      }
      if (state.isAdmin) {
        renderKdsOrders();
        updateKdsMetrics();
      }
      this.syncActiveCustomerOrder();
    } else if (data.type === 'PRODUCT_UPDATED') {
      const idx = state.products.findIndex(p => p.id === data.product.id);
      if (idx !== -1) {
        state.products[idx] = data.product;
      }
      renderMenu();
      if (state.isAdmin) renderAdminMenuTable();
    } else if (data.type === 'PRODUCT_CREATED') {
      state.products.push(data.product);
      renderMenu();
      if (state.isAdmin) renderAdminMenuTable();
    } else if (data.type === 'PRODUCT_DELETED') {
      state.products = state.products.filter(p => p.id !== data.product_id);
      renderMenu();
      if (state.isAdmin) renderAdminMenuTable();
    } else if (data.type === 'NOTIFICATION_UPDATED') {
      const idx = state.notifications.findIndex(n => n.product_id === data.notification.product_id);
      if (idx !== -1) {
        state.notifications[idx] = data.notification;
      } else {
        state.notifications.push(data.notification);
      }
      renderMenu();
      if (state.isAdmin) {
        renderAdminMenuTable();
        renderRestockTable();
      }
    } else if (data.type === 'RESTOCK_ALERTS_SENT') {
      showToast(`📢 Restock alerts broadcast to ${data.subscribers_alerted} students for ${data.product_name}!`, 'success');
      if (state.isAdmin) {
        renderRestockTable();
        renderAdminMenuTable();
      }
    }
  }

  syncActiveCustomerOrder() {
    if (!state.activeCustomerOrder) return;
    const current = state.orders.find(o => o.order_id === state.activeCustomerOrder.order_id);
    if (current) {
      const prevOrder = state.activeCustomerOrder;
      const prevStatus = prevOrder.order_status;

      // Check for newly packed items
      const prevPackedCount = (prevOrder.items || []).filter(i => i.packed).length;
      const currentPackedCount = (current.items || []).filter(i => i.packed).length;

      state.activeCustomerOrder = current;
      localStorage.setItem('ck_active_order', JSON.stringify(current));

      if (currentPackedCount > prevPackedCount) {
        sounds.playPop();
        const newlyPacked = (current.items || []).find(i => i.packed && !(prevOrder.items || []).find(pi => pi.id === i.id && pi.packed));
        const itemName = newlyPacked ? newlyPacked.name : 'An item';
        showToast(`📦 ${itemName} packed into your basket!`, 'info');
      }

      if (prevStatus !== current.order_status) {
        if (current.order_status === 'Ready for Counter Pickup' || current.order_status === 'Ready for Pickup') {
          sounds.playPickupReady();
          showToast(`🎉 Token #${current.token} is Ready for Counter Pickup!`, 'success');
        }
      }
      
      updatePassModalUI(current);
      updateHeaderPassButton();
    }
  }
}

const realtime = new RealtimeSync();

// ---------------------------------------------------------------------------
// 6. MENU & PRODUCT RENDERING
// ---------------------------------------------------------------------------
function getProductWaitlistCount(productId) {
  const notif = state.notifications.find(n => n.product_id === productId && n.status === 'Pending');
  return notif && notif.subscribers ? notif.subscribers.length : 0;
}

function renderMenu() {
  const grid = document.getElementById('menu-grid');
  const emptyState = document.getElementById('menu-empty-state');
  const counterLabel = document.getElementById('menu-counter-label');
  const catTitle = document.getElementById('current-category-title');
  if (!grid) return;

  let filtered = state.products;

  if (state.selectedCategory !== 'ALL') {
    filtered = filtered.filter(p => p.category.toLowerCase() === state.selectedCategory.toLowerCase());
  }

  if (state.searchQuery.trim() !== '') {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.category.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }

  if (catTitle) {
    catTitle.textContent = state.selectedCategory === 'ALL' ? 'All Items' : `${state.selectedCategory}`;
  }
  if (counterLabel) {
    counterLabel.textContent = `Showing ${filtered.length} items`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  grid.innerHTML = filtered.map(product => {
    const cartItem = state.cart.find(item => item.id === product.id);
    const inCartQty = cartItem ? cartItem.qty : 0;
    const isSoldOut = product.is_sold_out;
    const waitingCount = getProductWaitlistCount(product.id);

    return `
      <div class="food-card ${isSoldOut ? 'sold-out' : ''}" data-id="${product.id}">
        <div class="food-img-wrap">
          <img src="${product.img_url}" alt="${escapeHtml(product.name)}" class="food-img" loading="lazy" />
          <span class="food-cat-badge">${escapeHtml(product.category)}</span>
          ${isSoldOut ? '<div class="sold-out-overlay-badge">SOLD OUT</div>' : ''}
        </div>

        <div class="food-card-body">
          <h4 class="food-title">${escapeHtml(product.name)}</h4>
          <p class="food-desc">${escapeHtml(product.description || 'Essential campus item ready for instant pickup.')}</p>
          
          ${isSoldOut && waitingCount > 0 ? `
            <div class="restock-demand-pill">
              <i class="fa-solid fa-fire"></i> ${waitingCount} student${waitingCount > 1 ? 's' : ''} waiting
            </div>
          ` : ''}

          <div class="food-card-footer">
            <div class="food-price">
              <span class="rupee-symbol">₹</span>${product.price.toFixed(2)}
            </div>

            <div class="food-card-action">
              ${isSoldOut ? `
                <button class="btn-notify-me" onclick="openNotifyModal(${product.id})" title="Receive SMS/alert when back in stock">
                  <i class="fa-solid fa-bell"></i> Notify Me
                </button>
              ` : (inCartQty > 0 ? `
                <div class="card-qty-stepper">
                  <button class="qty-step-btn" onclick="decrementCartItem(${product.id})" aria-label="Decrease quantity">
                    <i class="fa-solid fa-minus"></i>
                  </button>
                  <span class="qty-step-val">${inCartQty}</span>
                  <button class="qty-step-btn" onclick="addToCart(${product.id})" aria-label="Increase quantity">
                    <i class="fa-solid fa-plus"></i>
                  </button>
                </div>
              ` : `
                <button class="btn-add-kart" onclick="addToCart(${product.id})" aria-label="Add ${escapeHtml(product.name)} to Kart">
                  <i class="fa-solid fa-plus"></i> Add
                </button>
              `)}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ---------------------------------------------------------------------------
// 7. "NOTIFY ME WHEN AVAILABLE" ENGINE
// ---------------------------------------------------------------------------
function openNotifyModal(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const modal = document.getElementById('notify-modal');
  const imgEl = document.getElementById('notify-prod-img');
  const titleEl = document.getElementById('notify-prod-title');
  const catEl = document.getElementById('notify-prod-cat');
  const priceEl = document.getElementById('notify-prod-price');
  const idInput = document.getElementById('notify-product-id');
  const subInput = document.getElementById('notify-subscriber-input');

  if (imgEl) imgEl.src = product.img_url;
  if (titleEl) titleEl.textContent = product.name;
  if (catEl) catEl.textContent = product.category;
  if (priceEl) priceEl.textContent = `₹${product.price.toFixed(2)}`;
  if (idInput) idInput.value = product.id;
  if (subInput) subInput.value = '';

  if (modal) modal.classList.remove('hidden-modal');
}

function closeNotifyModal() {
  const modal = document.getElementById('notify-modal');
  if (modal) modal.classList.add('hidden-modal');
}

async function handleNotifySubmit(e) {
  e.preventDefault();
  const idInput = document.getElementById('notify-product-id');
  const subInput = document.getElementById('notify-subscriber-input');
  if (!idInput || !subInput) return;

  const productId = parseInt(idInput.value);
  const subscriber = subInput.value.trim();

  if (!subscriber) {
    showToast('Please enter your mobile number or roll number', 'danger');
    return;
  }

  try {
    const res = await api.subscribeNotification(productId, subscriber);
    sounds.playSuccessChime();
    closeNotifyModal();
    showToast(res.message, 'success');

    // Update local state
    const idx = state.notifications.findIndex(n => n.product_id === productId);
    if (idx !== -1) {
      state.notifications[idx] = res.notification;
    } else {
      state.notifications.push(res.notification);
    }
    renderMenu();
    if (state.isAdmin) {
      renderAdminMenuTable();
      renderRestockTable();
    }
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ---------------------------------------------------------------------------
// 8. CART MANAGEMENT & SLIDE-OVER DRAWER
// ---------------------------------------------------------------------------
function saveCart() {
  localStorage.setItem('ck_cart', JSON.stringify(state.cart));
  updateCartBadge();
  renderCartDrawer();
  renderMenu();
}

function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  if (product.is_sold_out) {
    showToast(`${product.name} is currently Sold Out!`, 'danger');
    return;
  }

  const existing = state.cart.find(item => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      qty: 1,
      img_url: product.img_url
    });
  }

  sounds.playPop();
  saveCart();
  showToast(`Added ${product.name} to Kart`, 'info');
}

function decrementCartItem(productId) {
  const existing = state.cart.find(item => item.id === productId);
  if (!existing) return;

  if (existing.qty > 1) {
    existing.qty -= 1;
  } else {
    state.cart = state.cart.filter(item => item.id !== productId);
  }

  sounds.playPop();
  saveCart();
}

function removeCartItem(productId) {
  state.cart = state.cart.filter(item => item.id !== productId);
  sounds.playPop();
  saveCart();
}

function clearCart() {
  if (state.cart.length === 0) return;
  state.cart = [];
  saveCart();
  showToast('Kart cleared', 'info');
}

function updateCartBadge() {
  const badge = document.getElementById('cart-count-badge');
  if (!badge) return;
  const totalCount = state.cart.reduce((sum, item) => sum + item.qty, 0);
  badge.textContent = totalCount;
}

function getCartTotals() {
  const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  return { subtotal, total: subtotal };
}

function renderCartDrawer() {
  const listEl = document.getElementById('cart-items-list');
  const emptyNotice = document.getElementById('cart-empty-notice');
  const footerSummary = document.getElementById('cart-footer-summary');
  const subtotalEl = document.getElementById('bill-subtotal');
  const grandTotalEl = document.getElementById('bill-grand-total');

  if (!listEl) return;

  if (state.cart.length === 0) {
    listEl.innerHTML = '';
    if (emptyNotice) emptyNotice.classList.remove('hidden');
    if (footerSummary) footerSummary.classList.add('hidden');
    return;
  }

  if (emptyNotice) emptyNotice.classList.add('hidden');
  if (footerSummary) footerSummary.classList.remove('hidden');

  const { subtotal, total } = getCartTotals();
  if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
  if (grandTotalEl) grandTotalEl.textContent = `₹${total.toFixed(2)}`;

  listEl.innerHTML = state.cart.map(item => `
    <div class="cart-item-card">
      <img src="${item.img_url}" alt="${escapeHtml(item.name)}" class="cart-item-thumb" />
      <div class="cart-item-meta">
        <h5 class="cart-item-title">${escapeHtml(item.name)}</h5>
        <span class="cart-item-unit-price">₹${item.price.toFixed(2)} each</span>
      </div>
      <div class="cart-item-controls">
        <span class="cart-item-total">₹${(item.price * item.qty).toFixed(2)}</span>
        <div class="cart-qty-pill">
          <button class="cart-qty-btn" onclick="decrementCartItem(${item.id})" aria-label="Decrease quantity">
            <i class="fa-solid fa-minus"></i>
          </button>
          <span class="cart-qty-num">${item.qty}</span>
          <button class="cart-qty-btn" onclick="addToCart(${item.id})" aria-label="Increase quantity">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function toggleCartDrawer(open) {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-drawer-overlay');
  if (!drawer || !overlay) return;

  if (open) {
    renderCartDrawer();
    drawer.classList.add('open');
    overlay.classList.add('active');
  } else {
    drawer.classList.remove('open');
    overlay.classList.remove('active');
  }
}

// ---------------------------------------------------------------------------
// 9. CHECKOUT & DUAL PAYMENT SYSTEM
// ---------------------------------------------------------------------------
function openCheckoutModal() {
  if (state.cart.length === 0) {
    showToast('Your kart is empty!', 'danger');
    return;
  }

  toggleCartDrawer(false);
  const modal = document.getElementById('checkout-modal');
  if (!modal) return;

  const { total } = getCartTotals();
  const totalCount = state.cart.reduce((sum, item) => sum + item.qty, 0);

  const itemsCountEl = document.getElementById('checkout-items-count');
  const totalPayableEl = document.getElementById('checkout-total-payable');
  const upiAmountEl = document.getElementById('upi-display-amount');

  if (itemsCountEl) itemsCountEl.textContent = `${totalCount} item${totalCount > 1 ? 's' : ''}`;
  if (totalPayableEl) totalPayableEl.textContent = `₹${total.toFixed(2)}`;
  if (upiAmountEl) upiAmountEl.textContent = `₹${total.toFixed(2)}`;

  generateDynamicUpiQr(total);
  modal.classList.remove('hidden-modal');
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  if (modal) modal.classList.add('hidden-modal');
}

function generateDynamicUpiQr(amount) {
  const qrMount = document.getElementById('qr-code-mount');
  if (!qrMount) return;
  qrMount.innerHTML = '';

  const upiString = `upi://pay?pa=tuckshop@upi&pn=TuckShopKart&am=${amount.toFixed(2)}&cu=INR`;

  if (typeof QRCode !== 'undefined') {
    try {
      new QRCode(qrMount, {
        text: upiString,
        width: 124,
        height: 124,
        colorDark: "#2B2D42",
        colorLight: "#FFFFFF",
        correctLevel: QRCode.CorrectLevel.M
      });
      return;
    } catch (e) {}
  }

  // Fallback SVG QR simulator
  qrMount.innerHTML = `
    <svg width="124" height="124" viewBox="0 0 120 120" style="background:#fff;border-radius:4px;">
      <rect width="120" height="120" fill="#fff" />
      <rect x="10" y="10" width="30" height="30" fill="#2B2D42" rx="4"/>
      <rect x="16" y="16" width="18" height="18" fill="#fff" rx="2"/>
      <rect x="20" y="20" width="10" height="10" fill="#FF5E3A" rx="2"/>
      <rect x="80" y="10" width="30" height="30" fill="#2B2D42" rx="4"/>
      <rect x="86" y="16" width="18" height="18" fill="#fff" rx="2"/>
      <rect x="90" y="20" width="10" height="10" fill="#FF5E3A" rx="2"/>
      <rect x="10" y="80" width="30" height="30" fill="#2B2D42" rx="4"/>
      <rect x="16" y="86" width="18" height="18" fill="#fff" rx="2"/>
      <rect x="20" y="90" width="10" height="10" fill="#FF5E3A" rx="2"/>
      <rect x="50" y="50" width="20" height="20" fill="#FF5E3A" rx="4"/>
    </svg>
  `;
}

async function handleConfirmOrder() {
  const nameInput = document.getElementById('cust-name-input');
  const phoneInput = document.getElementById('cust-phone-input');
  const payMethodInput = document.querySelector('input[name="payment_method"]:checked');

  if (!nameInput || !phoneInput || !payMethodInput) return;

  const customerName = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const paymentMethod = payMethodInput.value;

  if (!customerName) {
    showToast('Please enter your full name', 'danger');
    nameInput.focus();
    return;
  }

  if (!phone || phone.length < 5) {
    showToast('Please enter a valid mobile number or roll number', 'danger');
    phoneInput.focus();
    return;
  }

  if (state.cart.length === 0) {
    showToast('Your kart is empty!', 'danger');
    return;
  }

  const { total } = getCartTotals();
  const submitBtn = document.getElementById('btn-confirm-order');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating Token...';
  }

  try {
    const orderPayload = {
      customer_name: customerName,
      phone: phone,
      items: state.cart.map(item => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
        price: item.price
      })),
      total_amount: total,
      payment_method: paymentMethod
    };

    const newOrder = await api.createOrder(orderPayload);
    sounds.playSuccessChime();

    state.cart = [];
    saveCart();

    state.activeCustomerOrder = newOrder;
    localStorage.setItem('ck_active_order', JSON.stringify(newOrder));

    closeCheckoutModal();
    openPassModal(newOrder);
    updateHeaderPassButton();

    showToast(`Order Placed! Your 4-Digit Pickup Token is #${newOrder.token}`, 'success');
  } catch (err) {
    showToast(`Order Failed: ${err.message}`, 'danger');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-ticket"></i> Place Order & Generate 4-Digit Token';
    }
  }
}

// ---------------------------------------------------------------------------
// 10. DIGITAL PICKUP PASS (MASSIVE 4-DIGIT TOKEN)
// ---------------------------------------------------------------------------
function openPassModal(order) {
  const targetOrder = order || state.activeCustomerOrder;
  if (!targetOrder) {
    showToast('No active order to display!', 'info');
    return;
  }

  updatePassModalUI(targetOrder);
  const modal = document.getElementById('pass-modal');
  if (modal) modal.classList.remove('hidden-modal');
}

function closePassModal() {
  const modal = document.getElementById('pass-modal');
  if (modal) modal.classList.add('hidden-modal');
}

function updatePassModalUI(order) {
  const tokenEl = document.getElementById('pass-token-number');
  const orderIdEl = document.getElementById('pass-order-id');
  const custNameEl = document.getElementById('pass-customer-name');
  const payStatusEl = document.getElementById('pass-payment-status');
  const itemsListEl = document.getElementById('pass-items-list');
  const totalEl = document.getElementById('pass-total-amount');
  const statusPill = document.getElementById('pass-status-pill');

  if (tokenEl) tokenEl.textContent = `#${order.token}`;
  if (orderIdEl) orderIdEl.textContent = order.order_id;
  if (custNameEl) custNameEl.textContent = order.customer_name;
  if (totalEl) totalEl.textContent = `₹${order.total_amount.toFixed(2)}`;

  if (payStatusEl) {
    const isPaid = order.payment_status === 'Paid';
    payStatusEl.className = `payment-badge-pill ${isPaid ? 'paid' : 'unpaid'}`;
    payStatusEl.textContent = order.payment_status;
  }

  if (itemsListEl) {
    itemsListEl.innerHTML = (order.items || []).map(i => `${i.qty}x ${escapeHtml(i.name)}`).join('<br/>');
  }

  // Live Basket Packing Tracker Section
  const packingItemsListEl = document.getElementById('pass-packing-items-list');
  const countTextEl = document.getElementById('pass-packing-count-text');
  const pctTextEl = document.getElementById('pass-packing-percent-text');
  const progressFillEl = document.getElementById('pass-progress-fill');
  const allDoneBannerEl = document.getElementById('pass-packing-all-done-banner');
  const doneTokenEl = document.getElementById('pass-done-token');

  const items = order.items || [];
  const totalItems = items.length;
  const packedCount = items.filter(it => it.packed).length;
  const pct = totalItems > 0 ? Math.round((packedCount / totalItems) * 100) : 0;
  const isAllPacked = totalItems > 0 && packedCount === totalItems;

  if (countTextEl) countTextEl.textContent = `${packedCount} of ${totalItems} items packed`;
  if (pctTextEl) pctTextEl.textContent = `${pct}%`;
  if (progressFillEl) {
    progressFillEl.style.width = `${pct}%`;
    if (isAllPacked) {
      progressFillEl.classList.add('complete');
    } else {
      progressFillEl.classList.remove('complete');
    }
  }

  if (allDoneBannerEl) {
    if (isAllPacked) {
      allDoneBannerEl.classList.remove('hidden');
      if (doneTokenEl) doneTokenEl.textContent = order.token;
    } else {
      allDoneBannerEl.classList.add('hidden');
    }
  }

  if (packingItemsListEl) {
    packingItemsListEl.innerHTML = items.map(item => {
      const isPacked = !!item.packed;
      return `
        <div class="student-packing-item ${isPacked ? 'packed' : ''}">
          <div class="student-packing-item-left">
            <div class="student-pack-icon">
              <i class="fa-solid ${isPacked ? 'fa-check' : 'fa-hourglass-half'}"></i>
            </div>
            <div>
              <span class="student-pack-name"><span class="student-pack-qty">${item.qty}x</span> ${escapeHtml(item.name)}</span>
            </div>
          </div>
          <span class="student-pack-badge ${isPacked ? 'packed' : 'pending'}">
            ${isPacked ? '<i class="fa-solid fa-circle-check"></i> In Basket' : '<i class="fa-solid fa-clock-rotate-left fa-spin"></i> Being Packed...'}
          </span>
        </div>
      `;
    }).join('');
  }

  if (statusPill) {
    statusPill.textContent = order.order_status;
    statusPill.className = `stepper-state-badge ${order.order_status.toLowerCase().replace(/\s+/g, '-')}`;
  }

  const statusLevels = {
    'Pending': 1,
    'Packing': 2,
    'In Progress': 2,
    'Preparing': 2,
    'Ready for Counter Pickup': 3,
    'Ready for Pickup': 3,
    'Handed Over': 4,
    'Completed': 4
  };
  const currentLevel = statusLevels[order.order_status] || 1;

  for (let step = 1; step <= 4; step++) {
    const node = document.getElementById(`step-${step}`);
    if (!node) continue;
    node.classList.remove('active', 'completed');
    if (step < currentLevel) {
      node.classList.add('completed');
    } else if (step === currentLevel) {
      node.classList.add('active');
    }
  }

  for (let conn = 1; conn <= 3; conn++) {
    const connector = document.getElementById(`conn-${conn}`);
    if (!connector) continue;
    if (conn < currentLevel) {
      connector.classList.add('filled');
    } else {
      connector.classList.remove('filled');
    }
  }
}

function updateHeaderPassButton() {
  const btn = document.getElementById('active-pass-btn');
  const label = document.getElementById('header-token-label');
  if (!btn || !label) return;

  if (state.activeCustomerOrder && state.activeCustomerOrder.order_status !== 'Handed Over' && state.activeCustomerOrder.order_status !== 'Completed') {
    label.textContent = `#${state.activeCustomerOrder.token}`;
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

// ---------------------------------------------------------------------------
// 11. SHOPKEEPER ACCESS & PIN AUTH
// ---------------------------------------------------------------------------
function openPinModal() {
  state.adminPinBuffer = '';
  const pinInput = document.getElementById('admin-pin-input');
  const errorMsg = document.getElementById('pin-error-msg');
  if (pinInput) pinInput.value = '';
  if (errorMsg) errorMsg.classList.add('hidden');

  const modal = document.getElementById('pin-modal');
  if (modal) modal.classList.remove('hidden-modal');
}

function closePinModal() {
  const modal = document.getElementById('pin-modal');
  if (modal) modal.classList.add('hidden-modal');
}

async function verifyAndEnterAdmin(pin) {
  try {
    const res = await api.verifyPin(pin);
    if (res.success) {
      state.isAdmin = true;
      closePinModal();
      switchViewMode(true);
      showToast('Welcome to Campus Operations Hub', 'success');
      renderKdsOrders();
      updateKdsMetrics();
      renderAdminMenuTable();
      renderRestockTable();
    } else {
      const errorMsg = document.getElementById('pin-error-msg');
      if (errorMsg) errorMsg.classList.remove('hidden');
      sounds.playPop();
    }
  } catch (e) {
    showToast('Verification failed. Check server.', 'danger');
  }
}

function switchViewMode(toAdmin) {
  state.isAdmin = toAdmin;
  const custView = document.getElementById('customer-view');
  const adminView = document.getElementById('admin-view');
  const modeText = document.getElementById('mode-text');
  const modeIcon = document.getElementById('mode-icon');
  const searchBox = document.getElementById('header-search-box');
  const cartBtn = document.getElementById('cart-drawer-btn');

  if (toAdmin) {
    if (custView) custView.classList.replace('active-view', 'hidden-view');
    if (adminView) adminView.classList.replace('hidden-view', 'active-view');
    if (modeText) modeText.textContent = 'Student Catalog';
    if (modeIcon) modeIcon.className = 'fa-solid fa-store';
    if (searchBox) searchBox.classList.add('hidden');
    if (cartBtn) cartBtn.classList.add('hidden');
  } else {
    if (custView) custView.classList.replace('hidden-view', 'active-view');
    if (adminView) adminView.classList.replace('active-view', 'hidden-view');
    if (modeText) modeText.textContent = 'Shopkeeper Admin';
    if (modeIcon) modeIcon.className = 'fa-solid fa-user-shield';
    if (searchBox) searchBox.classList.remove('hidden');
    if (cartBtn) cartBtn.classList.remove('hidden');
    renderMenu();
  }
}

// ---------------------------------------------------------------------------
// 12. SHOPKEEPER KDS & ACTIVE ORDERS
// ---------------------------------------------------------------------------
function updateKdsMetrics() {
  const totalOrdersEl = document.getElementById('metric-total-orders');
  const preparingEl = document.getElementById('metric-preparing');
  const readyEl = document.getElementById('metric-ready');
  const revenueEl = document.getElementById('metric-revenue');

  const totalOrders = state.orders.length;
  const preparing = state.orders.filter(o => o.order_status === 'In Progress' || o.order_status === 'Preparing' || o.order_status === 'Packing').length;
  const ready = state.orders.filter(o => o.order_status === 'Ready for Counter Pickup' || o.order_status === 'Ready for Pickup').length;
  const revenue = state.orders.reduce((sum, o) => sum + (o.payment_status === 'Paid' ? o.total_amount : 0), 0);

  if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;
  if (preparingEl) preparingEl.textContent = preparing;
  if (readyEl) readyEl.textContent = ready;
  if (revenueEl) revenueEl.textContent = `₹${revenue.toFixed(2)}`;
}

function renderKdsOrders() {
  const grid = document.getElementById('kds-orders-grid');
  const emptyState = document.getElementById('kds-empty-state');
  if (!grid) return;

  let filtered = state.orders;
  if (state.kdsFilter === 'ACTIVE') {
    filtered = filtered.filter(o => 
      o.order_status === 'Pending' || 
      o.order_status === 'Packing' ||
      o.order_status === 'In Progress' || o.order_status === 'Preparing' || 
      o.order_status === 'Ready for Counter Pickup' || o.order_status === 'Ready for Pickup'
    );
  } else if (state.kdsFilter === 'In Progress' || state.kdsFilter === 'Packing') {
    filtered = filtered.filter(o => o.order_status === 'Packing' || o.order_status === 'In Progress' || o.order_status === 'Preparing');
  } else if (state.kdsFilter !== 'ALL') {
    filtered = filtered.filter(o => o.order_status === state.kdsFilter);
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  grid.innerHTML = filtered.map(order => {
    const isPaid = order.payment_status === 'Paid';
    const timeAgo = formatTimeAgo(order.created_at);
    const items = order.items || [];
    const totalItems = items.length;
    const packedCount = items.filter(it => it.packed).length;
    const isAllPacked = totalItems > 0 && packedCount === totalItems;
    const packPercent = totalItems > 0 ? Math.round((packedCount / totalItems) * 100) : 0;

    return `
      <div class="kds-card ${isAllPacked ? 'all-packed' : ''}" data-order-id="${order.order_id}">
        <div class="kds-card-header">
          <div class="kds-token-tag">#${order.token}</div>
          <span class="kds-time-ago"><i class="fa-regular fa-clock"></i> ${timeAgo}</span>
        </div>

        <div class="kds-card-body">
          <div class="kds-customer-row">
            <span class="kds-customer-name"><i class="fa-solid fa-user-graduate"></i> ${escapeHtml(order.customer_name)}</span>
            <span class="kds-customer-phone">${escapeHtml(order.phone || order.customer_phone || '')}</span>
          </div>

          <div class="kds-payment-strip">
            <span>
              <strong>${order.payment_method}</strong>
              <span class="payment-badge-pill ${isPaid ? 'paid' : 'unpaid'}" style="margin-left:4px;">
                ${order.payment_status}
              </span>
            </span>
            ${!isPaid ? `
              <button class="btn-mark-paid" onclick="markOrderPaid('${order.order_id}')" title="Verify Counter Cash Receipt">
                <i class="fa-solid fa-check"></i> Mark Paid
              </button>
            ` : '<span class="text-success font-bold">₹' + order.total_amount.toFixed(2) + '</span>'}
          </div>

          <!-- Basket Packing Checklist Section -->
          <div class="kds-packing-wrap">
            <div class="kds-packing-head">
              <span class="kds-packing-title">
                <i class="fa-solid fa-boxes-packing text-accent"></i> Basket Packing Checklist
              </span>
              <button 
                class="kds-pack-all-btn" 
                onclick="handlePackAllItems('${order.order_id}', ${!isAllPacked})"
                title="${isAllPacked ? 'Reset checklist (unpack all)' : 'Pack all items at once'}"
              >
                <i class="fa-solid ${isAllPacked ? 'fa-rotate-left' : 'fa-check-double'}"></i>
                ${isAllPacked ? 'Reset' : 'Pack All'}
              </button>
            </div>

            <div class="kds-packing-bar-wrap">
              <div class="kds-packing-bar-info">
                <span>${packedCount} / ${totalItems} Items Packed</span>
                <span class="kds-packing-bar-pct">${packPercent}%</span>
              </div>
              <div class="kds-packing-track">
                <div class="kds-packing-fill ${isAllPacked ? 'full' : ''}" style="width: ${packPercent}%;"></div>
              </div>
            </div>

            <div class="kds-checklist">
              ${items.map(item => {
                const isPacked = !!item.packed;
                return `
                  <div 
                    class="kds-check-item ${isPacked ? 'is-packed' : ''}" 
                    onclick="handleToggleItemPacked('${order.order_id}', ${item.id})"
                    title="Click to toggle packed state"
                  >
                    <div class="kds-check-left">
                      <div class="kds-checkbox-custom">
                        <i class="fa-solid fa-check"></i>
                      </div>
                      <span class="kds-item-qty">${item.qty}x</span>
                      <span class="kds-check-name">${escapeHtml(item.name)}</span>
                    </div>
                    <div class="kds-check-right">
                      <span class="kds-item-pack-badge ${isPacked ? 'packed' : 'to-pack'}">
                        ${isPacked ? '✓ Packed' : 'To Pack'}
                      </span>
                      <span class="text-muted" style="font-size:0.75rem;">₹${(item.price * item.qty).toFixed(2)}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            ${isAllPacked && (order.order_status === 'Packing' || order.order_status === 'In Progress' || order.order_status === 'Preparing') ? `
              <div class="kds-all-packed-notice">
                <i class="fa-solid fa-circle-check text-success"></i>
                <span>All items packed! Ready for counter handover.</span>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="kds-card-footer">
          <div class="kds-status-actions">
            ${order.order_status === 'Pending' ? `
              <button class="btn-kds-step btn-prep" onclick="advanceOrderStatus('${order.order_id}', 'Packing')">
                <i class="fa-solid fa-boxes-packing"></i> Start Packing
              </button>
            ` : ''}

            ${order.order_status === 'Packing' || order.order_status === 'In Progress' || order.order_status === 'Preparing' ? `
              <button class="btn-kds-step btn-ready ${isAllPacked ? 'btn-ready-pulse' : ''}" onclick="advanceOrderStatus('${order.order_id}', 'Ready for Counter Pickup')">
                <i class="fa-solid fa-bell"></i> Mark Ready
              </button>
            ` : ''}

            ${order.order_status === 'Ready for Counter Pickup' || order.order_status === 'Ready for Pickup' ? `
              <button class="btn-kds-step btn-complete" onclick="advanceOrderStatus('${order.order_id}', 'Handed Over')">
                <i class="fa-solid fa-handshake"></i> Handover Done
              </button>
            ` : ''}

            ${order.order_status === 'Handed Over' || order.order_status === 'Completed' ? `
              <div class="text-muted font-medium" style="text-align:center;width:100%;padding:4px 0;">
                <i class="fa-solid fa-circle-check text-success"></i> Handed Over to Student
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function handleToggleItemPacked(orderId, itemId) {
  try {
    sounds.playPop();
    const updated = await api.toggleItemPacked(orderId, itemId);
    const idx = state.orders.findIndex(o => o.order_id === orderId);
    if (idx !== -1) state.orders[idx] = updated;

    renderKdsOrders();
    updateKdsMetrics();

    if (state.activeCustomerOrder && state.activeCustomerOrder.order_id === orderId) {
      state.activeCustomerOrder = updated;
      localStorage.setItem('ck_active_order', JSON.stringify(updated));
      updatePassModalUI(updated);
    }
  } catch (e) {
    showToast(`Failed to update item: ${e.message}`, 'danger');
  }
}

async function handlePackAllItems(orderId, targetPacked) {
  try {
    sounds.playPop();
    const updated = await api.packAllItems(orderId, targetPacked);
    const idx = state.orders.findIndex(o => o.order_id === orderId);
    if (idx !== -1) state.orders[idx] = updated;

    renderKdsOrders();
    updateKdsMetrics();

    const actionText = targetPacked ? 'packed' : 'unpacked';
    showToast(`Order #${updated.token} all items marked as ${actionText}`, 'info');

    if (state.activeCustomerOrder && state.activeCustomerOrder.order_id === orderId) {
      state.activeCustomerOrder = updated;
      localStorage.setItem('ck_active_order', JSON.stringify(updated));
      updatePassModalUI(updated);
    }
  } catch (e) {
    showToast(`Failed to update items: ${e.message}`, 'danger');
  }
}


async function advanceOrderStatus(orderId, nextStatus) {
  try {
    const updated = await api.patchOrder(orderId, { order_status: nextStatus });
    sounds.playPop();
    const idx = state.orders.findIndex(o => o.order_id === orderId);
    if (idx !== -1) state.orders[idx] = updated;

    renderKdsOrders();
    updateKdsMetrics();
    showToast(`Order #${updated.token} moved to ${nextStatus}`, 'info');
  } catch (e) {
    showToast(`Failed to update status: ${e.message}`, 'danger');
  }
}

async function markOrderPaid(orderId) {
  try {
    const updated = await api.patchOrder(orderId, { payment_status: 'Paid' });
    sounds.playPop();
    const idx = state.orders.findIndex(o => o.order_id === orderId);
    if (idx !== -1) state.orders[idx] = updated;

    renderKdsOrders();
    updateKdsMetrics();
    showToast(`Order #${updated.token} marked as Paid`, 'success');
  } catch (e) {
    showToast('Failed to update payment status', 'danger');
  }
}

// ---------------------------------------------------------------------------
// 13. INVENTORY MANAGEMENT HUB (FULL CRUD)
// ---------------------------------------------------------------------------
function renderAdminMenuTable() {
  const tbody = document.getElementById('menu-admin-table-body');
  if (!tbody) return;

  let list = state.products;
  if (state.adminMenuSearch.trim() !== '') {
    const q = state.adminMenuSearch.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }

  tbody.innerHTML = list.map(item => {
    const waitCount = getProductWaitlistCount(item.id);

    return `
      <tr data-product-id="${item.id}">
        <td>
          <div class="dish-cell">
            <img src="${item.img_url}" alt="${escapeHtml(item.name)}" class="dish-cell-thumb" />
            <div>
              <div class="dish-cell-name">${escapeHtml(item.name)}</div>
              <span class="text-muted" style="font-size:0.75rem;">ID: #${item.id}</span>
            </div>
          </div>
        </td>
        <td>
          <span class="food-cat-badge" style="position:static;display:inline-block;">${escapeHtml(item.category)}</span>
        </td>
        <td>
          <div class="price-edit-wrap">
            <span>₹</span>
            <input 
              type="number" 
              class="price-edit-input" 
              value="${item.price}" 
              min="1" 
              step="0.5"
              onchange="handlePriceChange(${item.id}, this.value)"
              onkeydown="if(event.key==='Enter') this.blur()"
              title="Edit price and press Enter to save"
            />
          </div>
        </td>
        <td>
          <button 
            class="btn-stock-toggle ${item.is_sold_out ? 'sold-out' : 'in-stock'}" 
            onclick="toggleProductStock(${item.id}, ${!item.is_sold_out})"
            title="Click to toggle Stock Status"
          >
            <i class="fa-solid ${item.is_sold_out ? 'fa-circle-xmark' : 'fa-circle-check'}"></i>
            <span>${item.is_sold_out ? 'Sold Out' : 'In Stock'}</span>
          </button>
        </td>
        <td>
          ${waitCount > 0 ? `
            <span class="restock-demand-pill">🔥 ${waitCount} student${waitCount > 1 ? 's' : ''}</span>
          ` : '<span class="text-muted">-</span>'}
        </td>
        <td>
          <div class="action-btn-group">
            <button class="btn-action-icon edit" onclick="openEditProductModal(${item.id})" title="Edit Details">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn-action-icon delete" onclick="handleDeleteProduct(${item.id})" title="Delete Product">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function handlePriceChange(productId, newPriceVal) {
  const price = parseFloat(newPriceVal);
  if (isNaN(price) || price <= 0) {
    showToast('Invalid price entered', 'danger');
    renderAdminMenuTable();
    return;
  }

  try {
    const updated = await api.updateProduct(productId, { price });
    sounds.playPop();
    const idx = state.products.findIndex(p => p.id === productId);
    if (idx !== -1) state.products[idx] = updated;

    showToast(`Updated ${updated.name} price to ₹${updated.price.toFixed(2)}`, 'success');
  } catch (e) {
    showToast('Failed to update price', 'danger');
  }
}

async function toggleProductStock(productId, newSoldOutState) {
  try {
    const updated = await api.updateProduct(productId, { is_sold_out: newSoldOutState });
    sounds.playPop();
    const idx = state.products.findIndex(p => p.id === productId);
    if (idx !== -1) state.products[idx] = updated;

    renderAdminMenuTable();
    renderMenu();
    showToast(`${updated.name} is now ${updated.is_sold_out ? 'Sold Out' : 'In Stock'}`, 'info');
  } catch (e) {
    showToast('Failed to update stock status', 'danger');
  }
}

// Full Edit Product
function openEditProductModal(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  document.getElementById('edit-prod-id').value = product.id;
  document.getElementById('edit-prod-name').value = product.name;
  document.getElementById('edit-prod-category').value = product.category;
  document.getElementById('edit-prod-price').value = product.price;
  document.getElementById('edit-prod-image').value = product.img_url;
  document.getElementById('edit-prod-desc').value = product.description || '';

  const modal = document.getElementById('edit-prod-modal');
  if (modal) modal.classList.remove('hidden-modal');
}

function closeEditProductModal() {
  const modal = document.getElementById('edit-prod-modal');
  if (modal) modal.classList.add('hidden-modal');
}

async function handleEditProductSubmit(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById('edit-prod-id').value);
  const name = document.getElementById('edit-prod-name').value.trim();
  const category = document.getElementById('edit-prod-category').value;
  const price = parseFloat(document.getElementById('edit-prod-price').value);
  const img_url = document.getElementById('edit-prod-image').value.trim();
  const description = document.getElementById('edit-prod-desc').value.trim();

  if (!name || isNaN(price) || price <= 0 || !img_url) {
    showToast('Please fill all required product details', 'danger');
    return;
  }

  try {
    const updated = await api.updateProduct(id, { name, category, price, img_url, description });
    sounds.playSuccessChime();
    const idx = state.products.findIndex(p => p.id === id);
    if (idx !== -1) state.products[idx] = updated;

    closeEditProductModal();
    renderAdminMenuTable();
    renderMenu();
    showToast(`Updated product "${updated.name}"`, 'success');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Delete Product
async function handleDeleteProduct(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  if (!confirm(`Are you sure you want to remove "${product.name}" from inventory?`)) {
    return;
  }

  try {
    await api.deleteProduct(productId);
    sounds.playPop();
    state.products = state.products.filter(p => p.id !== productId);
    renderAdminMenuTable();
    renderMenu();
    showToast(`Removed "${product.name}" from inventory`, 'info');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Add Product
function openAddDishModal() {
  const modal = document.getElementById('add-dish-modal');
  if (modal) modal.classList.remove('hidden-modal');
}

function closeAddDishModal() {
  const modal = document.getElementById('add-dish-modal');
  if (modal) modal.classList.add('hidden-modal');
}

async function handleAddDishSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('dish-name').value.trim();
  const category = document.getElementById('dish-category').value;
  const price = parseFloat(document.getElementById('dish-price').value);
  const imgUrl = document.getElementById('dish-image').value.trim();
  const desc = document.getElementById('dish-desc').value.trim();

  if (!name || isNaN(price) || price <= 0 || !imgUrl) {
    showToast('Please fill all required dish details properly', 'danger');
    return;
  }

  try {
    const newDish = await api.createProduct({
      name,
      category,
      price,
      img_url: imgUrl,
      description: desc,
      is_sold_out: false
    });

    sounds.playSuccessChime();
    state.products.push(newDish);
    closeAddDishModal();
    document.getElementById('add-dish-form').reset();
    renderMenu();
    renderAdminMenuTable();
    showToast(`Added "${newDish.name}" to inventory!`, 'success');
  } catch (err) {
    showToast(`Failed to add product: ${err.message}`, 'danger');
  }
}

// ---------------------------------------------------------------------------
// 14. RESTOCK DEMANDS TAB (ADMIN)
// ---------------------------------------------------------------------------
function renderRestockTable() {
  const tbody = document.getElementById('restock-admin-table-body');
  const tabBadge = document.getElementById('restock-tab-badge');
  if (!tbody) return;

  const pendingDemands = state.notifications.filter(n => n.status === 'Pending' && n.subscribers && n.subscribers.length > 0);
  if (tabBadge) tabBadge.textContent = pendingDemands.length;

  if (state.notifications.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">No student restock requests recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.notifications.map(notif => {
    const subscriberCount = notif.subscribers ? notif.subscribers.length : 0;
    const isPending = notif.status === 'Pending';

    return `
      <tr>
        <td><strong>${escapeHtml(notif.product_name)}</strong> (ID #${notif.product_id})</td>
        <td>
          <span class="restock-demand-pill">🔥 ${subscriberCount} student${subscriberCount > 1 ? 's' : ''}</span>
        </td>
        <td>
          <div class="subscriber-tags-wrap">
            ${(notif.subscribers || []).map(s => `<span class="sub-tag">${escapeHtml(s)}</span>`).join('')}
          </div>
        </td>
        <td>
          <span class="payment-badge-pill ${isPending ? 'unpaid' : 'paid'}">
            ${isPending ? 'Waiting for Stock' : 'Alerts Broadcasted'}
          </span>
        </td>
        <td>
          ${isPending ? `
            <button class="btn-restock-alert" onclick="triggerRestockAlerts(${notif.product_id})">
              <i class="fa-solid fa-bell"></i> Restock & Send Alerts
            </button>
          ` : `
            <span class="text-success font-medium"><i class="fa-solid fa-check-double"></i> Restocked</span>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

async function triggerRestockAlerts(productId) {
  try {
    const res = await api.sendRestockAlerts(productId);
    sounds.playSuccessChime();
    showToast(res.message, 'success');

    // Update product stock in memory
    const p = state.products.find(prod => prod.id === productId);
    if (p) p.is_sold_out = false;

    // Refresh views
    const notifs = await api.getNotifications();
    state.notifications = notifs;

    renderMenu();
    renderAdminMenuTable();
    renderRestockTable();
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'danger');
  }
}

// ---------------------------------------------------------------------------
// 15. EVENT LISTENERS SETUP
// ---------------------------------------------------------------------------
function setupEventListeners() {
  document.getElementById('btn-brand-home')?.addEventListener('click', () => {
    state.selectedCategory = 'ALL';
    state.searchQuery = '';
    const searchInput = document.getElementById('menu-search-input');
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('.cat-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === 'ALL');
    });
    renderMenu();
  });

  document.getElementById('sound-toggle-btn')?.addEventListener('click', () => {
    const isEnabled = sounds.toggleSound();
    const icon = document.getElementById('sound-icon');
    if (icon) {
      icon.className = isEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
    }
    showToast(isEnabled ? 'Sound effects enabled' : 'Sound muted', 'info');
  });

  document.getElementById('active-pass-btn')?.addEventListener('click', () => {
    openPassModal(state.activeCustomerOrder);
  });

  document.getElementById('cart-drawer-btn')?.addEventListener('click', () => toggleCartDrawer(true));
  document.getElementById('cart-close-btn')?.addEventListener('click', () => toggleCartDrawer(false));
  document.getElementById('cart-drawer-overlay')?.addEventListener('click', () => toggleCartDrawer(false));
  document.getElementById('cart-clear-btn')?.addEventListener('click', clearCart);
  document.getElementById('cart-browse-btn')?.addEventListener('click', () => toggleCartDrawer(false));

  // Category filter tabs
  document.getElementById('category-filter-bar')?.addEventListener('click', (e) => {
    const pill = e.target.closest('.cat-pill');
    if (!pill) return;
    document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
    pill.classList.add('active');
    state.selectedCategory = pill.dataset.category;
    renderMenu();
  });

  // Search
  const searchInput = document.getElementById('menu-search-input');
  const clearSearchBtn = document.getElementById('search-clear-btn');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (clearSearchBtn) clearSearchBtn.classList.toggle('hidden', state.searchQuery === '');
      renderMenu();
    });
  }
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      state.searchQuery = '';
      clearSearchBtn.classList.add('hidden');
      renderMenu();
    });
  }

  document.getElementById('reset-filter-btn')?.addEventListener('click', () => {
    state.selectedCategory = 'ALL';
    state.searchQuery = '';
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('.cat-pill').forEach(b => b.classList.toggle('active', b.dataset.category === 'ALL'));
    renderMenu();
  });

  // Checkout modal
  document.getElementById('cart-checkout-btn')?.addEventListener('click', openCheckoutModal);
  document.getElementById('checkout-close-btn')?.addEventListener('click', closeCheckoutModal);
  document.getElementById('btn-cancel-checkout')?.addEventListener('click', closeCheckoutModal);
  document.getElementById('btn-confirm-order')?.addEventListener('click', handleConfirmOrder);

  document.querySelectorAll('input[name="payment_method"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'));
      e.target.closest('.payment-option')?.classList.add('selected');

      const upiContainer = document.getElementById('upi-qr-container');
      if (upiContainer) {
        if (e.target.value === 'UPI') {
          upiContainer.classList.remove('hidden');
        } else {
          upiContainer.classList.add('hidden');
        }
      }
    });
  });

  // Pass modal
  document.getElementById('pass-close-btn')?.addEventListener('click', closePassModal);
  document.getElementById('btn-minimize-pass')?.addEventListener('click', closePassModal);
  document.getElementById('btn-new-order-pass')?.addEventListener('click', () => {
    closePassModal();
    toggleCartDrawer(false);
  });

  // Notify Me modal
  document.getElementById('notify-close-btn')?.addEventListener('click', closeNotifyModal);
  document.getElementById('btn-cancel-notify')?.addEventListener('click', closeNotifyModal);
  document.getElementById('notify-form')?.addEventListener('submit', handleNotifySubmit);

  // Admin switch & PIN modal
  document.getElementById('view-mode-toggle-btn')?.addEventListener('click', () => {
    if (state.isAdmin) {
      switchViewMode(false);
    } else {
      openPinModal();
    }
  });
  document.getElementById('btn-exit-admin')?.addEventListener('click', () => switchViewMode(false));
  document.getElementById('pin-close-btn')?.addEventListener('click', closePinModal);

  document.querySelectorAll('.key-btn[data-val]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pinInput = document.getElementById('admin-pin-input');
      if (pinInput && pinInput.value.length < 4) {
        pinInput.value += btn.dataset.val;
        if (pinInput.value.length === 4) verifyAndEnterAdmin(pinInput.value);
      }
    });
  });

  document.getElementById('key-clear-btn')?.addEventListener('click', () => {
    const pinInput = document.getElementById('admin-pin-input');
    if (pinInput) pinInput.value = '';
    document.getElementById('pin-error-msg')?.classList.add('hidden');
  });

  document.getElementById('key-enter-btn')?.addEventListener('click', () => {
    const pinInput = document.getElementById('admin-pin-input');
    if (pinInput) verifyAndEnterAdmin(pinInput.value);
  });

  document.getElementById('admin-pin-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') verifyAndEnterAdmin(e.target.value);
  });

  // KDS filters
  document.getElementById('kds-status-filter-group')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.kds-filter-btn');
    if (!btn) return;
    document.querySelectorAll('.kds-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.kdsFilter = btn.dataset.status;
    renderKdsOrders();
  });

  document.getElementById('kitchen-audio-toggle')?.addEventListener('change', (e) => {
    state.kitchenAudioAlert = e.target.checked;
    showToast(e.target.checked ? 'Order chime ON' : 'Order chime OFF', 'info');
  });

  // Admin Sub-Tabs
  document.getElementById('tab-btn-kds')?.addEventListener('click', () => {
    switchAdminTab('kds');
  });
  document.getElementById('tab-btn-menu')?.addEventListener('click', () => {
    switchAdminTab('menu');
  });
  document.getElementById('tab-btn-restock')?.addEventListener('click', () => {
    switchAdminTab('restock');
  });

  document.getElementById('admin-menu-search')?.addEventListener('input', (e) => {
    state.adminMenuSearch = e.target.value;
    renderAdminMenuTable();
  });

  // Add Product
  document.getElementById('btn-add-product')?.addEventListener('click', openAddDishModal);
  document.getElementById('add-dish-close-btn')?.addEventListener('click', closeAddDishModal);
  document.getElementById('btn-cancel-add-dish')?.addEventListener('click', closeAddDishModal);
  document.getElementById('add-dish-form')?.addEventListener('submit', handleAddDishSubmit);

  // Edit Product
  document.getElementById('edit-prod-close-btn')?.addEventListener('click', closeEditProductModal);
  document.getElementById('btn-cancel-edit-prod')?.addEventListener('click', closeEditProductModal);
  document.getElementById('edit-prod-form')?.addEventListener('submit', handleEditProductSubmit);

  // Preset images
  document.querySelectorAll('.preset-img-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const urlInput = document.getElementById('dish-image');
      if (urlInput) urlInput.value = btn.dataset.url;
    });
  });
}

function switchAdminTab(tabName) {
  const kdsTabBtn = document.getElementById('tab-btn-kds');
  const menuTabBtn = document.getElementById('tab-btn-menu');
  const restockTabBtn = document.getElementById('tab-btn-restock');

  const kdsContent = document.getElementById('admin-kds-tab-content');
  const menuContent = document.getElementById('admin-menu-tab-content');
  const restockContent = document.getElementById('admin-restock-tab-content');

  kdsTabBtn?.classList.toggle('active', tabName === 'kds');
  menuTabBtn?.classList.toggle('active', tabName === 'menu');
  restockTabBtn?.classList.toggle('active', tabName === 'restock');

  if (kdsContent) kdsContent.className = `admin-tab-content ${tabName === 'kds' ? 'active-tab' : 'hidden-tab'}`;
  if (menuContent) menuContent.className = `admin-tab-content ${tabName === 'menu' ? 'active-tab' : 'hidden-tab'}`;
  if (restockContent) restockContent.className = `admin-tab-content ${tabName === 'restock' ? 'active-tab' : 'hidden-tab'}`;

  if (tabName === 'menu') renderAdminMenuTable();
  if (tabName === 'restock') renderRestockTable();
  if (tabName === 'kds') renderKdsOrders();
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTimeAgo(isoString) {
  if (!isoString) return 'Just now';
  const diff = Math.floor((new Date() - new Date(isoString)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

// ---------------------------------------------------------------------------
// 16. APP INIT
// ---------------------------------------------------------------------------
async function initApp() {
  setupEventListeners();
  updateCartBadge();
  updateHeaderPassButton();

  try {
    const [products, orders, notifications] = await Promise.all([
      api.getProducts(),
      api.getOrders(),
      api.getNotifications()
    ]);

    state.products = products;
    state.orders = orders;
    state.notifications = notifications;

    renderMenu();
    realtime.start();
  } catch (err) {
    showToast(`Failed to initialize: ${err.message}`, 'danger');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
