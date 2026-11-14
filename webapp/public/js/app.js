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

  /* ---------------- shopping companion ---------------- */
  const shop = document.getElementById('shop-app');
  if (shop) {
    const token = shop.dataset.token;
    const scanForm = document.getElementById('scan-form');
    const scanResult = document.getElementById('scan-result');
    const cartList = document.getElementById('cart-list');
    const recipesBtn = document.getElementById('recipes-btn');
    const recipesPanel = document.getElementById('recipes-panel');
    const recipesList = document.getElementById('recipes-list');
    const missingList = document.getElementById('missing-list');
    const recipesSource = document.getElementById('recipes-source');

    function renderScan(item) {
      scanResult.hidden = false;
      scanResult.innerHTML = '';
      const card = el('div', 'result-card status-' + item.status);
      const head = el('div', 'rec-head');
      head.appendChild(el('span', 'badge badge--' + item.status, item.status));
      head.appendChild(el('span', 'pill', 'SKU ' + item.sku));
      card.appendChild(head);
      card.appendChild(el('h3', null, item.name));
      card.appendChild(el('p', 'muted small', 'Aisle ' + item.aisle + ' · Shelf ' + item.shelf + ' · Bin ' + item.bin + ' · ' + item.onHand + ' on hand'));

      if (item.reasons.length) {
        const ul = el('ul');
        item.reasons.forEach(function (reason) { ul.appendChild(el('li', null, reason)); });
        card.appendChild(ul);
      } else {
        card.appendChild(el('p', 'small', 'No clinical conflicts detected for your profile.'));
      }

      if (item.status === 'restricted') {
        card.appendChild(el('p', 'small', 'Please leave this item on the shelf. A volunteer can suggest a swap.'));
      } else {
        const add = el('button', 'btn btn--primary btn--sm', item.status === 'capped' ? 'Add one serving' : 'Add to cart');
        add.type = 'button';
        add.addEventListener('click', function () {
          add.disabled = true;
          request('/api/cart', { method: 'POST', body: JSON.stringify({ sku: item.sku }) })
            .then(function (data) { renderCart(cartList, data.cart, remove); add.textContent = 'Added'; })
            .catch(function (err) { add.disabled = false; add.textContent = err.message; });
        });
        card.appendChild(add);
      }

      scanResult.appendChild(card);
    }

    async function scan(sku) {
      try {
        const data = await request('/api/scan', { method: 'POST', body: JSON.stringify({ sku: sku }) });
        renderScan(data.item);
      } catch (err) {
        scanResult.hidden = false;
        scanResult.innerHTML = '';
        scanResult.appendChild(el('div', 'banner banner--error', err.message));
      }
    }

    function remove(sku) {
      request('/api/cart/' + encodeURIComponent(sku), { method: 'DELETE' })
        .then(function (data) { renderCart(cartList, data.cart, remove); })
        .catch(function (err) { alert(err.message); });
    }

    scanForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const input = document.getElementById('sku');
      const value = input.value.trim();
      if (value) scan(value);
      input.value = '';
    });

    cartList.addEventListener('click', function (event) {
      const button = event.target.closest('.js-remove');
      if (button) remove(button.dataset.sku);
    });

    document.querySelectorAll('.js-add').forEach(function (button) {
      button.addEventListener('click', function () {
        button.disabled = true;
        request('/api/cart', { method: 'POST', body: JSON.stringify({ sku: button.dataset.sku }) })
          .then(function (data) {
            renderCart(cartList, data.cart, remove);
            button.textContent = 'Added';
          })
          .catch(function (err) {
            button.disabled = false;
            button.textContent = err.message;
          });
      });
    });

    recipesBtn.addEventListener('click', function () {
      recipesBtn.disabled = true;
      recipesBtn.textContent = 'Thinking…';
      request('/api/recipes')
        .then(function (data) {
          recipesPanel.hidden = false;
          recipesSource.textContent = data.source + (data.latencyMs ? ' · ' + data.latencyMs + ' ms' : '');
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
            recipesList.appendChild(el('p', 'muted', 'Add a few items first — we need at least a protein and a vegetable.'));
          }
          missingList.innerHTML = '';
          (data.missingIngredients || []).forEach(function (item) {
            missingList.appendChild(
              el('li', null, item.name + ' — aisle ' + item.aisle + ', shelf ' + item.shelf + ', bin ' + item.bin + ' (' + item.onHand + ' on hand)'),
            );
          });
          if (!(data.missingIngredients || []).length) {
            missingList.appendChild(el('li', 'muted', 'You already have everything for these recipes.'));
          }
        })
        .catch(function (err) {
          recipesPanel.hidden = false;
          recipesList.innerHTML = '';
          recipesList.appendChild(el('p', 'banner banner--error', err.message));
        })
        .finally(function () {
          recipesBtn.disabled = false;
          recipesBtn.textContent = 'Suggest recipes from my cart';
        });
    });

    /* Optional camera scan — BarcodeDetector is a browser API, no external service. */
    const cameraBtn = document.getElementById('camera-btn');
    const video = document.getElementById('camera-preview');
    if (cameraBtn && video) {
      if (!('BarcodeDetector' in window)) {
        cameraBtn.hidden = true;
      } else {
        let stream = null;
        cameraBtn.addEventListener('click', async function () {
          if (stream) {
            stream.getTracks().forEach(function (track) { track.stop(); });
            stream = null;
            video.hidden = true;
            return;
          }
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;
            video.hidden = false;
            await video.play();
            const detector = new window.BarcodeDetector({ formats: ['ean_13', 'upc_a', 'code_128'] });
            const tick = async function () {
              if (!stream) return;
              const codes = await detector.detect(video);
              if (codes.length) {
                document.getElementById('sku').value = codes[0].rawValue;
                scan(codes[0].rawValue);
                stream.getTracks().forEach(function (track) { track.stop(); });
                stream = null;
                video.hidden = true;
                return;
              }
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          } catch (err) {
            scanResult.hidden = false;
            scanResult.innerHTML = '';
            scanResult.appendChild(el('div', 'banner banner--error', 'Camera unavailable: ' + err.message));
          }
        });
      }
    }
  }

  /* ---------------- volunteer exit terminal ---------------- */
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

    if (scanForm) {
      scanForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const input = document.getElementById('checkout-sku');
        const sku = input.value.trim();
        if (!sku) return;
        input.value = '';
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
            completeBtn.hidden = true;
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
