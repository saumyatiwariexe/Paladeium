// Cart state and checkout flow manager

export class CartManager {
  constructor({ apiBase, restaurantSlug }) {
    this.apiBase         = apiBase;
    this.restaurantSlug  = restaurantSlug;
    this.items           = []; // [{ item, qty }]
    this._setupCartUI();
    this._setupCheckoutUI();
  }

  // ── Public API ─────────────────────────────────────────────

  addItem(item) {
    const existing = this.items.find(e => e.item.id === item.id);
    if (existing) {
      existing.qty += 1;
    } else {
      this.items.push({ item, qty: 1 });
    }
    this._updateCartBadge();
    this._showAddedFeedback(item.name);
  }

  openCart() {
    this._renderCartPanel();
    const panel = document.getElementById('cart-panel');
    if (panel) panel.classList.add('visible');
  }

  // ── Private: Cart panel ────────────────────────────────────

  _setupCartUI() {
    // Cart button opens panel
    document.getElementById('cart-fab')?.addEventListener('click', () => this.openCart());
    document.getElementById('cart-panel-close')?.addEventListener('click', () => {
      document.getElementById('cart-panel')?.classList.remove('visible');
    });
  }

  _updateCartBadge() {
    const total = this.items.reduce((s, e) => s + e.qty, 0);
    const badge = document.getElementById('cart-badge');
    if (badge) {
      badge.textContent = String(total);
      badge.style.display = total > 0 ? 'flex' : 'none';
    }
  }

  _showAddedFeedback(name) {
    const toast = document.getElementById('cart-toast');
    if (!toast) return;
    toast.textContent = `${name} added to cart`;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2200);
  }

  _renderCartPanel() {
    const list  = document.getElementById('cart-items-list');
    const total = document.getElementById('cart-total-amount');
    if (!list) return;

    list.innerHTML = '';

    if (this.items.length === 0) {
      list.innerHTML = '<div class="cart-empty">Your cart is empty</div>';
      if (total) total.textContent = '₹0';
      return;
    }

    let sum = 0;
    this.items.forEach(({ item, qty }) => {
      const priceNum = parseInt((item.price || '0').replace(/[^\d]/g, ''), 10) || 0;
      sum += priceNum * qty;

      const row = document.createElement('div');
      row.className = 'cart-item-row';
      row.innerHTML = `
        <span class="cart-item-emoji">${item.emoji || '🍽'}</span>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${item.price}</div>
        </div>
        <div class="cart-qty-control">
          <button class="qty-btn minus" data-id="${item.id}">−</button>
          <span class="qty-val">${qty}</span>
          <button class="qty-btn plus"  data-id="${item.id}">+</button>
        </div>
      `;
      list.appendChild(row);
    });

    list.querySelectorAll('.qty-btn.minus').forEach(btn => {
      btn.addEventListener('click', () => { this._changeQty(btn.dataset.id, -1); this._renderCartPanel(); });
    });
    list.querySelectorAll('.qty-btn.plus').forEach(btn => {
      btn.addEventListener('click', () => { this._changeQty(btn.dataset.id, +1); this._renderCartPanel(); });
    });

    if (total) total.textContent = `₹${sum}`;

    const checkoutBtn = document.getElementById('cart-checkout-btn');
    if (checkoutBtn) checkoutBtn.onclick = () => this._openCheckout(sum);
  }

  _changeQty(id, delta) {
    const entry = this.items.find(e => e.item.id === id);
    if (!entry) return;
    entry.qty = Math.max(0, entry.qty + delta);
    if (entry.qty === 0) this.items = this.items.filter(e => e.item.id !== id);
    this._updateCartBadge();
  }

  // ── Private: Checkout form ─────────────────────────────────

  _setupCheckoutUI() {
    document.getElementById('checkout-back-btn')?.addEventListener('click', () => {
      document.getElementById('checkout-panel')?.classList.remove('visible');
      this.openCart();
    });

    document.getElementById('checkout-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this._submitOrder();
    });

    document.getElementById('order-retry-btn')?.addEventListener('click', () => {
      document.getElementById('order-error-screen')?.classList.remove('visible');
      document.getElementById('checkout-panel')?.classList.add('visible');
    });

    document.getElementById('order-done-btn')?.addEventListener('click', () => {
      document.getElementById('order-success-screen')?.classList.remove('visible');
      document.getElementById('cart-panel')?.classList.remove('visible');
      this.items = [];
      this._updateCartBadge();
    });
  }

  _openCheckout(totalAmount) {
    document.getElementById('cart-panel')?.classList.remove('visible');
    const panel = document.getElementById('checkout-panel');
    if (panel) {
      document.getElementById('checkout-total-display').textContent = `₹${totalAmount}`;
      panel.classList.add('visible');
    }
  }

  async _submitOrder() {
    const form = document.getElementById('checkout-form');
    if (!form) return;

    const name    = form.querySelector('[name=cust-name]')?.value?.trim();
    const phone   = form.querySelector('[name=cust-phone]')?.value?.trim();
    const address = form.querySelector('[name=cust-address]')?.value?.trim();
    const gender  = form.querySelector('[name=cust-gender]')?.value;
    const age     = form.querySelector('[name=cust-age]')?.value?.trim();

    if (!name || !phone || !address || !gender || !age) {
      this._showFormError('Please fill all fields.');
      return;
    }

    const submitBtn = document.getElementById('checkout-submit-btn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Placing Order…'; }

    const payload = {
      customer: { name, phone, address, gender, age: Number(age) },
      items: this.items.map(({ item, qty }) => ({
        id:    item.id,
        name:  item.name,
        price: item.price,
        qty,
      })),
      total: this.items.reduce((s, { item, qty }) => {
        return s + (parseInt((item.price || '0').replace(/[^\d]/g, ''), 10) || 0) * qty;
      }, 0),
    };

    try {
      const res = await fetch(
        `${this.apiBase}/api/restaurants/${this.restaurantSlug}/orders`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        }
      );

      document.getElementById('checkout-panel')?.classList.remove('visible');

      if (res.ok) {
        const data = await res.json();
        this._showSuccessScreen(data);
      } else {
        this._showErrorScreen();
      }
    } catch {
      document.getElementById('checkout-panel')?.classList.remove('visible');
      this._showErrorScreen();
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Place Order'; }
    }
  }

  _showFormError(msg) {
    const el = document.getElementById('checkout-form-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; setTimeout(() => { el.style.display = 'none'; }, 3000); }
  }

  _showSuccessScreen(data) {
    const screen = document.getElementById('order-success-screen');
    const orderNum = document.getElementById('order-success-num');
    if (orderNum) orderNum.textContent = data.orderId ?? '#' + Math.floor(Math.random() * 90000 + 10000);
    if (screen) screen.classList.add('visible');
  }

  _showErrorScreen() {
    const screen = document.getElementById('order-error-screen');
    if (screen) screen.classList.add('visible');
  }
}
