/*
 * Akalynth site behaviour: tab navigation, shop catalogue rendering,
 * and a localStorage-backed cart. Vanilla JS, no dependencies.
 *
 * Note: this is a preview storefront. No payment is processed; "checkout"
 * is illustrative while Akalynth is pre-alpha.
 */
(function () {
  "use strict";

  // ---- Catalogue -----------------------------------------------------------
  // Prices are in Azura coins; USD shown as an illustrative reference.
  var CATALOG = [
    {
      id: "coins-small",
      name: "Pouch of Coins",
      tag: "Coin Pack",
      art: "🪙",
      desc: "250 Azura coins to spend in the realm.",
      coins: 250,
      usd: 4.99,
    },
    {
      id: "coins-medium",
      name: "Chest of Coins",
      tag: "Coin Pack",
      art: "💰",
      desc: "750 Azura coins, plus a 10% bonus hoard.",
      coins: 750,
      usd: 12.99,
    },
    {
      id: "coins-large",
      name: "Dragon's Hoard",
      tag: "Coin Pack",
      art: "🐉",
      desc: "2,000 Azura coins, plus a 20% bonus hoard.",
      coins: 2000,
      usd: 29.99,
    },
    {
      id: "premium-30",
      name: "Premium Time — 30 Days",
      tag: "Premium",
      art: "⏳",
      desc: "A month of premium: faster travel, extra stash slots.",
      coins: 500,
      usd: 9.99,
    },
    {
      id: "premium-90",
      name: "Premium Time — 90 Days",
      tag: "Premium",
      art: "🕰",
      desc: "A full season of premium benefits at a better rate.",
      coins: 1200,
      usd: 24.99,
    },
    {
      id: "cosmetic-warden",
      name: "Warden's Regalia",
      tag: "Cosmetic",
      art: "🛡",
      desc: "An ornate cosmetic set. Looks only — never pay-to-win.",
      coins: 900,
      usd: 14.99,
    },
    {
      id: "cosmetic-lantern",
      name: "Everlight Lantern",
      tag: "Cosmetic",
      art: "🏮",
      desc: "A glowing companion lantern for your travels.",
      coins: 400,
      usd: 6.99,
    },
    {
      id: "cosmetic-mount",
      name: "Stone Strider Mount",
      tag: "Cosmetic",
      art: "🐎",
      desc: "A cosmetic mount skin. Cosmetic speed feel, no stats.",
      coins: 1500,
      usd: 19.99,
    },
  ];

  var CART_KEY = "akalynth.cart.v1";
  var byId = {};
  CATALOG.forEach(function (item) {
    byId[item.id] = item;
  });

  // ---- DOM helpers ---------------------------------------------------------
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function fmt(n) {
    return n.toLocaleString("en-US");
  }

  // ---- Tabs (index page only) ----------------------------------------------
  // On index.html the primary nav switches between in-page panels. On other
  // pages (e.g. shop.html) there are no .tab-panel elements, so this is inert
  // and the nav links navigate normally.
  function syncNavActive(name) {
    $all(".tab-btn[data-nav]").forEach(function (link) {
      var active = link.getAttribute("data-nav") === name;
      link.classList.toggle("is-active", active);
      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function activateTab(name) {
    if (!name || !document.getElementById(name)) return;
    $all(".tab-panel").forEach(function (panel) {
      var active = panel.id === name;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
    syncNavActive(name);
    if (window.location.hash !== "#" + name) {
      history.replaceState(null, "", "#" + name);
    }
    var main = $("#main");
    if (main) main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function initTabs() {
    var panels = $all(".tab-panel");
    if (!panels.length) return; // not the tabbed page (e.g. shop.html)

    // Intercept nav targets that map to an in-page panel; leave the rest
    // (e.g. the Shop link -> shop.html) as ordinary navigation.
    $all("[data-nav]").forEach(function (el) {
      var name = el.getAttribute("data-nav");
      if (document.getElementById(name)) {
        el.addEventListener("click", function (e) {
          e.preventDefault();
          activateTab(name);
        });
      }
    });

    window.addEventListener("hashchange", function () {
      var h = window.location.hash.replace("#", "");
      if (document.getElementById(h)) activateTab(h);
    });

    var initial = (window.location.hash || "").replace("#", "");
    var valid = panels.map(function (p) {
      return p.id;
    });
    activateTab(valid.indexOf(initial) !== -1 ? initial : "home");
  }

  // ---- Cart state ----------------------------------------------------------
  function loadCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
      return {};
    }
  }
  function saveCart(cart) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (err) {
      /* storage unavailable — cart stays in memory for the session */
    }
  }

  var cart = loadCart();
  // Drop any stale ids no longer in the catalogue.
  Object.keys(cart).forEach(function (id) {
    if (!byId[id]) delete cart[id];
  });

  function cartTotals() {
    var count = 0;
    var coins = 0;
    Object.keys(cart).forEach(function (id) {
      var qty = cart[id];
      count += qty;
      coins += byId[id].coins * qty;
    });
    return { count: count, coins: coins };
  }

  function addToCart(id) {
    if (!byId[id]) return;
    cart[id] = (cart[id] || 0) + 1;
    saveCart(cart);
    render();
  }
  function removeFromCart(id) {
    if (!cart[id]) return;
    cart[id] -= 1;
    if (cart[id] <= 0) delete cart[id];
    saveCart(cart);
    render();
  }
  function clearCart() {
    cart = {};
    saveCart(cart);
    render();
  }

  // ---- Rendering -----------------------------------------------------------
  function renderShop() {
    var grid = $("#shop-grid");
    if (!grid || grid.dataset.built === "1") return;
    CATALOG.forEach(function (item) {
      var card = document.createElement("article");
      card.className = "shop-card";
      card.innerHTML =
        '<div class="shop-card-art" aria-hidden="true">' +
        item.art +
        "</div>" +
        '<div class="shop-card-body">' +
        '<span class="shop-tag">' +
        item.tag +
        "</span>" +
        '<h3 class="shop-card-name">' +
        item.name +
        "</h3>" +
        '<p class="shop-card-desc">' +
        item.desc +
        "</p>" +
        '<div class="shop-card-price">' +
        fmt(item.coins) +
        " coins" +
        '<span class="usd">≈ $' +
        item.usd.toFixed(2) +
        "</span></div>" +
        '<button class="btn btn-gold" data-add="' +
        item.id +
        '">Add to cart</button>' +
        "</div>";
      grid.appendChild(card);
    });
    grid.dataset.built = "1";
    grid.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-add]");
      if (btn) addToCart(btn.getAttribute("data-add"));
    });
  }

  function renderCart() {
    var totals = cartTotals();
    var ids = Object.keys(cart);

    var list = $("#cart-items");
    if (list) {
      list.innerHTML = "";
      if (ids.length === 0) {
        var empty = document.createElement("li");
        empty.className = "cart-empty";
        empty.textContent = "Your cart is empty.";
        list.appendChild(empty);
      } else {
        ids.forEach(function (id) {
          var item = byId[id];
          var qty = cart[id];
          var li = document.createElement("li");
          li.className = "cart-item";
          li.innerHTML =
            "<span>" +
            '<span class="cart-item-name">' +
            item.name +
            "</span> " +
            '<span class="cart-qty">×' +
            qty +
            "</span></span>" +
            '<span><span class="cart-item-price">' +
            fmt(item.coins * qty) +
            "</span> " +
            '<button class="cart-remove" data-remove="' +
            id +
            '" aria-label="Remove one ' +
            item.name +
            '">✕</button></span>';
          list.appendChild(li);
        });
      }
    }

    // Totals in several places.
    [["#cart-count", totals.count], ["#cart-total", totals.coins], ["#cart-total-2", totals.coins]].forEach(
      function (pair) {
        var el = $(pair[0]);
        if (el) el.textContent = fmt(pair[1]);
      }
    );

    var checkout = $("#checkout-btn");
    if (checkout) checkout.disabled = totals.count === 0;
  }

  function render() {
    renderShop();
    renderCart();
  }

  function initCart() {
    var list = $("#cart-items");
    if (list) {
      list.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-remove]");
        if (btn) removeFromCart(btn.getAttribute("data-remove"));
      });
    }
    var clearBtn = $("#clear-cart-btn");
    if (clearBtn) clearBtn.addEventListener("click", clearCart);
    var checkout = $("#checkout-btn");
    if (checkout) {
      checkout.addEventListener("click", function () {
        var totals = cartTotals();
        alert(
          "Preview checkout — no payment is processed.\n\n" +
            totals.count +
            " item(s) · " +
            fmt(totals.coins) +
            " coins (≈ $" +
            estimateUsd().toFixed(2) +
            ").\n\nReal purchases open with the Akalynth beta."
        );
      });
    }
  }

  function estimateUsd() {
    var usd = 0;
    Object.keys(cart).forEach(function (id) {
      usd += byId[id].usd * cart[id];
    });
    return usd;
  }

  // ---- Year + boot ---------------------------------------------------------
  function initMisc() {
    var y = $("#year");
    if (y) y.textContent = new Date().getFullYear();
  }

  function boot() {
    initTabs();
    initCart();
    initMisc();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
