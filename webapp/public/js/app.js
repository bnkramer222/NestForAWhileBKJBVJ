/* Shared client behaviour for the shopping companion and volunteer terminal. */
(function () {
  'use strict';

  async function request(url, options) {
    const response = await fetch(url, {
      headers: { 'content-type': 'application/json' },
      ...options,
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      /* non-JSON error body */
    }
    if (!response.ok) {
      const error = new Error(data.error || 'Request failed (' + response.status + ')');
      error.status = response.status;
      error.details = data.details;
      throw error;
    }
    return data;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderCart(list, cart, onRemove) {
    list.innerHTML = '';
    if (!cart.length) {
      list.appendChild(el('li', 'muted', 'Nothing scanned yet.'));
      return;
    }
    cart.forEach(function (item) {
      const li = el('li');
      li.dataset.sku = item.sku;
      li.appendChild(el('span', 'badge badge--' + item.evaluated_status, item.evaluated_status));
      li.appendChild(el('span', 'cart-name', item.name));
      li.appendChild(el('span', 'muted', '×' + item.quantity));
      const remove = el('button', 'link-btn', 'remove');
      remove.type = 'button';
      remove.dataset.sku = item.sku;
      remove.addEventListener('click', function () { onRemove(item.sku); });
      li.appendChild(remove);
      list.appendChild(li);
    });
  }

  /*
   * Camera scanner shared by the shopping companion and the exit terminal.
   * Uses html5-qrcode (open source, self-hosted): native BarcodeDetector where the browser has it,
   * ZXing decoding everywhere else (iPhone Safari, Firefox). Reads product barcodes and QR codes.
   * Cameras need HTTPS (or localhost).
   */
  function attachScanner(buttonId, containerId, onCode, onError) {
    const button = document.getElementById(buttonId);
    const container = document.getElementById(containerId);
    if (!button || !container) return;
    const idleLabel = button.textContent;
    if (!window.Html5Qrcode || !navigator.mediaDevices || !window.isSecureContext) {
      button.hidden = true; // no camera support here — typing the code still works
      return;
    }
    const F = window.Html5QrcodeSupportedFormats;
    let scanner = null;

    async function stop() {
      if (!scanner) return;
      const active = scanner;
      scanner = null;
      try { await active.stop(); } catch (_) { /* already stopped */ }
      try { active.clear(); } catch (_) { /* nothing rendered */ }
      container.hidden = true;
      button.textContent = idleLabel;
    }

    button.addEventListener('click', async function () {
      if (scanner) return stop();
      container.hidden = false;
      button.textContent = 'Stop camera';
      scanner = new window.Html5Qrcode(containerId, {
        formatsToSupport: [F.QR_CODE, F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        verbose: false,
      });
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: function (w, h) { const s = Math.floor(Math.min(w, h) * 0.8); return { width: s, height: Math.floor(s * 0.6) }; } },
          function (decoded) {
            const code = String(decoded || '').trim();
            if (!code) return;
            stop().then(function () { onCode(code); });
          },
          function () { /* no code in this frame — keep scanning */ },
        );
      } catch (err) {
        await stop();
        onError('Camera unavailable: ' + ((err && err.message) || err) + '. You can type the code instead.');
      }
    });
  }

  /* ---------------- kiosk: scan the client card QR to check in ---------------- */
  attachScanner('kiosk-camera-btn', 'kiosk-camera', function (code) {
    const input = document.getElementById('token');
    const form = input && input.form;
    if (!form) return;
    input.value = code;
    form.submit();
  }, function (message) { alert(message); });

  /* Print button on the demo barcode sheet (no inline handlers: CSP blocks them). */
  document.querySelectorAll('.js-print').forEach(function (button) {
    button.addEventListener('click', function () { window.print(); });
  });

  /* ---------------- waiting line: live position, auto-advance when admitted ---------------- */
  const queueApp = document.getElementById('queue-app');
  if (queueApp) {
    const qToken = queueApp.dataset.token;
    const posEl = document.getElementById('queue-pos');
    const aheadEl = document.getElementById('queue-ahead');
    const statusEl = document.getElementById('queue-status');
    let failures = 0;
    const poll = function () {
      request('/api/queue/' + encodeURIComponent(qToken))
        .then(function (data) {
          failures = 0;
          statusEl.hidden = true;
          if (data.status === 'active') {
            statusEl.hidden = false;
            statusEl.textContent = "It's your turn! Taking you to your shopping list…";
            window.location.href = '/queue?token=' + encodeURIComponent(qToken);
            return;
          }
          if (data.status !== 'queue_waiting') { window.location.href = '/queue?token=' + encodeURIComponent(qToken); return; }
          posEl.textContent = data.position;
          const ahead = Math.max(data.position - 1, 0);
          aheadEl.textContent = ahead === 0 ? "You're next!" : ahead + (ahead === 1 ? ' household' : ' households') + ' ahead of you';
          setTimeout(poll, 5000);
        })
        .catch(function () {
          failures += 1;
          statusEl.hidden = false;
          statusEl.textContent = 'Weak signal — still holding your place. Retrying…';
          setTimeout(poll, Math.min(30000, 5000 * failures)); // back off on bad warehouse Wi-Fi
        });
    };
    setTimeout(poll, 5000);
  }

  /* ---------------- shopping companion ---------------- */
  const shop = document.getElementById('shop-app');
  if (shop) {
    const COPY = JSON.parse(shop.dataset.statusCopy || '{}');
    const scanForm = document.getElementById('scan-form');
    const scanResult = document.getElementById('scan-result');
    const cartList = document.getElementById('cart-list');
    const cartCount = document.getElementById('cart-count');
    const cartNotice = document.getElementById('cart-notice');
    const recipesBtn = document.getElementById('recipes-btn');
    const recipesPanel = document.getElementById('recipes-panel');
    const recipesList = document.getElementById('recipes-list');
    const missingList = document.getElementById('missing-list');
    const recipesSource = document.getElementById('recipes-source');
    const sheet = document.getElementById('confirm-sheet');
    let cart = JSON.parse(shop.dataset.cart || '[]');

    const label = function (status) { return (COPY[status] && COPY[status].label) || status; };

    function showNotice(text) {
      cartNotice.hidden = !text;
      cartNotice.textContent = text || '';
    }

    function qtyOf(sku) {
      const line = cart.find(function (item) { return item.sku === sku; });
      return line ? line.quantity : 0;
    }

    function renderShopCart() {
      cartList.innerHTML = '';
      const units = cart.reduce(function (sum, item) { return sum + item.quantity; }, 0);
      cartCount.textContent = units + (units === 1 ? ' item' : ' items');
      if (!cart.length) {
        cartList.appendChild(el('li', 'muted', 'Your cart is empty. Scan or add items as you go.'));
        return;
      }
      cart.forEach(function (item) {
        const li = el('li', 'cart-line');
        li.dataset.sku = item.sku;
        const top = el('div', 'cart-top');
        top.appendChild(el('span', 'badge badge--' + item.status, label(item.status)));
        top.appendChild(el('span', 'cart-name', item.name));
        const qty = el('div', 'qty');
        const dec = el('button', 'qty-btn js-dec', '−');
        dec.type = 'button';
        dec.setAttribute('aria-label', 'One less ' + item.name);
        const inc = el('button', 'qty-btn js-inc', '+');
        inc.type = 'button';
        inc.setAttribute('aria-label', 'One more ' + item.name);
        if (item.quantity >= item.onHand) inc.disabled = true;
        qty.appendChild(dec);
        qty.appendChild(el('span', 'qty-n', String(item.quantity)));
        qty.appendChild(inc);
        top.appendChild(qty);
        const remove = el('button', 'link-btn js-remove', 'remove');
        remove.type = 'button';
        top.appendChild(remove);
        li.appendChild(top);
        if (item.status === 'restricted') {
          li.appendChild(el('p', 'cart-warn', 'A volunteer will check this one with you at the exit.'));
        } else if (item.overCap) {
          li.appendChild(el('p', 'cart-warn', 'We suggest about ' + item.capServings + ' serving' + (item.capServings === 1 ? '' : 's') + ' of this — your choice.'));
        }
        cartList.appendChild(li);
      });
    }

    /* Restricted items: a calm confirmation instead of a hard "no". Resolves true/false. */
    function askConfirm(item) {
      return new Promise(function (resolve) {
        document.getElementById('confirm-name').textContent = item.name;
        const reasons = document.getElementById('confirm-reasons');
        reasons.innerHTML = '';
        (item.reasons || []).forEach(function (reason) { reasons.appendChild(el('li', null, reason)); });
        sheet.hidden = false;
        const yes = document.getElementById('confirm-yes');
        const no = document.getElementById('confirm-no');
        no.focus();
        function done(answer) {
          sheet.hidden = true;
          yes.removeEventListener('click', onYes);
          no.removeEventListener('click', onNo);
          resolve(answer);
        }
        function onYes() { done(true); }
        function onNo() { done(false); }
        yes.addEventListener('click', onYes);
        no.addEventListener('click', onNo);
      });
    }

    /* One path for every cart change: add, +, −. Handles the restricted-item confirmation. */
    async function changeCart(sku, method, body) {
      const url = method === 'POST' ? '/api/cart' : '/api/cart/' + encodeURIComponent(sku);
      const payload = Object.assign({ sku: sku }, body || {});
      try {
        const data = await request(url, { method: method, body: JSON.stringify(payload) });
        cart = data.cart;
        renderShopCart();
        showNotice(data.notice);
        return true;
      } catch (err) {
        if (err.details && err.details.code === 'CONFIRM_RESTRICTED') {
          const ok = await askConfirm(err.details.item);
          if (!ok) { showNotice('No problem — left on the shelf.'); return false; }
          return changeCart(sku, method, Object.assign({}, body, { confirm: true }));
        }
        showNotice(err.message);
        return false;
      }
    }

    function addOne(sku, button) {
      if (button) button.disabled = true;
      return changeCart(sku, 'POST', { quantity: 1 }).then(function (ok) {
        if (button) {
          button.disabled = false;
          if (ok) {
            button.textContent = 'In cart (' + qtyOf(sku) + ') · add one more';
          }
        }
        return ok;
      });
    }

    function renderScan(item, inCart) {
      scanResult.hidden = false;
      scanResult.innerHTML = '';
      const copy = COPY[item.status] || {};
      const card = el('div', 'result-card status-' + item.status);
      const head = el('div', 'rec-head');
      head.appendChild(el('span', 'badge badge--' + item.status, label(item.status)));
      head.appendChild(el('span', 'pill', '#' + item.sku));
      card.appendChild(head);
      card.appendChild(el('h3', null, item.name));
      card.appendChild(el('p', 'small', copy.headline ? copy.headline + '. ' + (copy.detail || '') : ''));
      card.appendChild(el('p', 'muted small', 'Aisle ' + item.aisle + ' · Shelf ' + item.shelf + ' · Bin ' + item.bin + ' · ' + item.onHand + ' on the shelf'));
      if (item.reasons.length) {
        const why = el('details', 'why');
        why.appendChild(el('summary', null, 'Why?'));
        const ul = el('ul');
        item.reasons.forEach(function (reason) { ul.appendChild(el('li', null, reason)); });
        why.appendChild(ul);
        card.appendChild(why);
      }
      const add = el('button', 'btn btn--primary btn--sm', inCart ? 'In cart (' + inCart + ') · add one more' : (item.status === 'restricted' ? 'Add anyway' : 'Add to cart'));
      add.type = 'button';
      add.addEventListener('click', function () { addOne(item.sku, add); });
      card.appendChild(add);
      scanResult.appendChild(card);
    }

    async function scan(code) {
      try {
        const data = await request('/api/scan', { method: 'POST', body: JSON.stringify({ sku: code }) });
        renderScan(data.item, data.quantityInCart);
      } catch (err) {
        scanResult.hidden = false;
        scanResult.innerHTML = '';
        scanResult.appendChild(el('div', 'banner banner--error', err.message));
      }
    }

    scanForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const input = document.getElementById('sku');
      const value = input.value.trim();
      if (value) scan(value);
      input.value = '';
    });

    cartList.addEventListener('click', function (event) {
      const line = event.target.closest('.cart-line');
      if (!line) return;
      const sku = line.dataset.sku;
      if (event.target.closest('.js-inc')) changeCart(sku, 'PATCH', { quantity: qtyOf(sku) + 1 });
      else if (event.target.closest('.js-dec')) changeCart(sku, 'PATCH', { quantity: qtyOf(sku) - 1 });
      else if (event.target.closest('.js-remove')) changeCart(sku, 'PATCH', { quantity: 0 });
    });

    document.querySelectorAll('.js-add').forEach(function (button) {
      button.addEventListener('click', function () { addOne(button.dataset.sku, button); });
    });

    /* Search across "Everything on the floor today" */
    const search = document.getElementById('browse-search');
    if (search) {
      search.addEventListener('input', function () {
        const q = search.value.trim().toLowerCase();
        let shown = 0;
        document.querySelectorAll('.browse-item').forEach(function (row) {
          const match = !q || row.dataset.name.indexOf(q) !== -1;
          row.hidden = !match;
          if (match) shown += 1;
        });
        document.querySelectorAll('.browse-group').forEach(function (group) {
          const any = group.querySelector('.browse-item:not([hidden])');
          group.hidden = !any;
          if (q && any) group.open = true;
        });
        document.getElementById('browse-empty').hidden = shown > 0;
      });
    }

    recipesBtn.addEventListener('click', function () {
      recipesBtn.disabled = true;
      recipesBtn.textContent = 'Thinking up some meals…';
      request('/api/recipes')
        .then(function (data) {
          recipesPanel.hidden = false;
          recipesSource.textContent = data.source === 'open-source-engine' ? 'AI suggestions' : 'Kitchen-tested ideas';
          recipesList.innerHTML = '';
          (data.recipes || []).forEach(function (recipe) {
            const card = el('article', 'recipe');
            card.appendChild(el('h3', null, recipe.title));
            const steps = el('ol');
            (recipe.steps || []).forEach(function (step) { steps.appendChild(el('li', null, step)); });
            card.appendChild(steps);
            if (recipe.clinicalFit) card.appendChild(el('p', 'fit', recipe.clinicalFit));
            recipesList.appendChild(card);
          });
          if (!(data.recipes || []).length) {
            recipesList.appendChild(el('p', 'muted', 'Add a few more items — a protein and a vegetable are a great start.'));
          }
          missingList.innerHTML = '';
          (data.missingIngredients || []).forEach(function (item) {
            const li = el('li', null, item.name + ' — aisle ' + item.aisle + ', shelf ' + item.shelf + ', bin ' + item.bin + ' ');
            const add = el('button', 'link-btn', 'add');
            add.type = 'button';
            add.addEventListener('click', function () { addOne(item.sku, add); });
            li.appendChild(add);
            missingList.appendChild(li);
          });
          if (!(data.missingIngredients || []).length) {
            missingList.appendChild(el('li', 'muted', 'You already have everything for these meals.'));
          }
          recipesPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
        .catch(function (err) {
          recipesPanel.hidden = false;
          recipesList.innerHTML = '';
          recipesList.appendChild(el('p', 'banner banner--error', err.message));
        })
        .finally(function () {
          recipesBtn.disabled = false;
          recipesBtn.textContent = 'Get meal ideas from my cart';
        });
    });

    /* Camera scan (barcodes + QR) — works on iPhone/Safari via the self-hosted html5-qrcode library. */
    attachScanner('camera-btn', 'camera-preview', function (code) {
      document.getElementById('sku').value = code;
      scan(code);
    }, function (message) {
      scanResult.hidden = false;
      scanResult.innerHTML = '';
      scanResult.appendChild(el('div', 'banner banner--error', message));
    });

    renderShopCart();

    /* Heartbeat: keeps this shopper's floor slot while the page is open (slots of people who
       walk away are released after SHOPPING_TIMEOUT_MIN). Also refreshes the cart. */
    setInterval(function () {
      request('/api/cart').then(function (data) { cart = data.cart; renderShopCart(); }).catch(function () {});
    }, 120000);
  }

  /* ---------------- volunteer exit terminal ---------------- */
  attachScanner('token-camera-btn', 'token-camera', function (code) {
    window.location.href = '/checkout?token=' + encodeURIComponent(code);
  }, function (message) { alert(message); });

  const checkout = document.getElementById('checkout-app');
  if (checkout) {
    const token = checkout.dataset.token;
    const cartList = document.getElementById('checkout-cart');
    const scanForm = document.getElementById('checkout-scan');
    const completeBtn = document.getElementById('complete-btn');
    const hardStop = document.getElementById('hard-stop');
    const hardStopItems = document.getElementById('hard-stop-items');
    const hardStopMessage = document.getElementById('hard-stop-message');
    const receipt = document.getElementById('receipt');
    const hint = document.getElementById('checkout-hint');

    function showHardStop(err) {
      hardStop.hidden = false;
      hardStopItems.innerHTML = '';
      const items = (err.details && err.details.items) || [];
      hardStopMessage.textContent = err.message;
      items.forEach(function (item) {
        hardStopItems.appendChild(el('li', null, item.name + ' (' + item.sku + ')'));
      });
      hardStop.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function remove(sku) {
      request('/api/checkout/items/' + encodeURIComponent(sku) + '/remove', {
        method: 'POST',
        body: JSON.stringify({ token: token }),
      })
        .then(function (data) { renderCart(cartList, data.cart, remove); })
        .catch(function (err) { alert(err.message); });
    }

    cartList.addEventListener('click', function (event) {
      const button = event.target.closest('.js-remove-checkout');
      if (button) remove(button.dataset.sku);
    });

    function addScanned(sku) {
      request('/api/checkout/items', { method: 'POST', body: JSON.stringify({ token: token, sku: sku }) })
        .then(function (data) {
          renderCart(cartList, data.cart, remove);
          hint.textContent = data.item.name + ' — ' + data.item.status;
          hint.className = 'small';
        })
        .catch(function (err) {
          hint.textContent = err.message;
          hint.className = 'banner banner--error';
        });
    }

    if (scanForm) {
      scanForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const input = document.getElementById('checkout-sku');
        const sku = input.value.trim();
        if (!sku) return;
        input.value = '';
        addScanned(sku);
      });
      attachScanner('checkout-camera-btn', 'checkout-camera', addScanned, function (message) {
        hint.textContent = message;
        hint.className = 'banner banner--error';
      });
    }

    if (completeBtn) {
      completeBtn.addEventListener('click', function () {
        completeBtn.disabled = true;
        completeBtn.textContent = 'Processing…';
        request('/api/checkout/complete', { method: 'POST', body: JSON.stringify({ token: token }) })
          .then(function (data) {
            hardStop.hidden = true;
            receipt.hidden = false;
            receipt.innerHTML = '';
            receipt.appendChild(el('h3', null, 'Checkout complete'));
            receipt.appendChild(el('p', null, data.receipt.itemCount + ' line items · ' + data.receipt.totalWeightLbs + ' lb distributed'));
            const list = el('ul');
            data.receipt.lines.forEach(function (line) {
              list.appendChild(el('li', null, line.quantity + ' × ' + line.name + ' (' + line.evaluated_status + ')'));
            });
            receipt.appendChild(list);
            if (data.admittedFromQueue) {
              receipt.appendChild(el('p', 'small', data.admittedFromQueue + ' household(s) admitted from the waiting line.'));
            }
            completeBtn.textContent = 'Checkout complete';
            completeBtn.hidden = true;
            const checkoutCamera = document.getElementById('checkout-camera-btn');
            if (checkoutCamera) checkoutCamera.hidden = true;
            if (scanForm) scanForm.hidden = true;
          })
          .catch(function (err) {
            completeBtn.disabled = false;
            completeBtn.textContent = 'Complete checkout';
            if (err.details && err.details.code === 'RESTRICTED_ITEM') {
              showHardStop(err);
            } else {
              receipt.hidden = false;
              receipt.className = 'receipt banner--error';
              receipt.textContent = err.message;
            }
          });
      });
    }
  }
})();
