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

  // ---- Game worlds ---------------------------------------------------------
  // Preview game worlds (separate servers). Flavor only while pre-alpha.
  var WORLDS = [
    { id: "azura", name: "Azura", type: "Open", region: "EU", stage: "Pre-alpha" },
    { id: "rookhold", name: "Rookhold", type: "Open", region: "NA", stage: "Pre-alpha" },
    { id: "emberfell", name: "Emberfell", type: "Hardcore", region: "EU", stage: "Planned" },
  ];
  var worldById = {};
  WORLDS.forEach(function (w) {
    worldById[w.id] = w;
  });

  // ---- House preview (fixed-price + resale) --------------------------------
  // Mirrors the CURRENTLY SUPPORTED server property model: fixed-price primary
  // purchase (a gold sink) + owner resale via list/unlist
  // (apps/server/src/world/property.ts, docs/V1_SCOPE.md). Plots and prices are
  // taken from packages/shared/maps/azura.json (H1/H2/H3).
  // INVARIANT: LOCAL PREVIEW ONLY — it does not prove ownership, spend real
  // currency, or affect live game state. Auctions are PLANNED and NOT yet
  // implemented server-side, so they are shown here as non-interactive only
  // (no bidding, no countdown, no settlement).
  var ACCOUNT_KEY = "akalynth.account.v1";
  var HOUSES_KEY = "akalynth.houses.v1"; // preview ownership state
  var START_GOLD = 50000; // preview starting balance for a new character

  var HOUSES = [
    { id: "H1", name: "Harbor Edge Plot", world: "Azura", district: "Harbor Edge", coords: "(10, 32)", priceGold: 500 },
    { id: "H2", name: "Market Quarter Plot", world: "Azura", district: "Market Quarter", coords: "(14, 32)", priceGold: 1000 },
    { id: "H3", name: "South Gate Plot", world: "Azura", district: "South Gate", coords: "(18, 32)", priceGold: 2000 },
  ];
  var houseById = {};
  HOUSES.forEach(function (h) {
    houseById[h.id] = h;
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
        var msg =
          "Preview checkout — no payment is processed.\n\n" +
          totals.count +
          " item(s) · " +
          fmt(totals.coins) +
          " coins (≈ $" +
          estimateUsd().toFixed(2) +
          ").\n\nReal purchases open with the Akalynth beta.";
        // Buying Premium Time marks the preview character as Premium. Preview
        // only — no real entitlement is created. (Houses do not require
        // Premium: standard plots are buyable by any character.)
        if (cartHasPremium()) {
          if (account) {
            account.premium = true;
            saveAccount(account);
            renderHoldings();
            msg += "\n\nPreview Premium activated.";
          } else {
            msg += "\n\nCreate a character to apply preview Premium.";
          }
        }
        alert(msg);
      });
    }
  }

  function cartHasPremium() {
    return Object.keys(cart).some(function (id) {
      return byId[id] && byId[id].tag === "Premium";
    });
  }

  function estimateUsd() {
    var usd = 0;
    Object.keys(cart).forEach(function (id) {
      usd += byId[id].usd * cart[id];
    });
    return usd;
  }

  function setText(sel, txt) {
    var el = $(sel);
    if (el) el.textContent = txt;
  }
  function setErr(id, msg) {
    var el = document.getElementById(id);
    if (el) el.textContent = msg;
  }

  // ---- Account (local preview character) -----------------------------------
  // Stored locally only. INVARIANT: this is not a real account; no server
  // identity, world transfer, or game data is created.
  function loadAccount() {
    try {
      var raw = localStorage.getItem(ACCOUNT_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && parsed.name ? parsed : null;
    } catch (err) {
      return null;
    }
  }
  function saveAccount(acct) {
    try {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acct));
    } catch (err) {
      /* storage unavailable — character stays in memory for the session */
    }
  }
  function clearAccount() {
    try {
      localStorage.removeItem(ACCOUNT_KEY);
    } catch (err) {
      /* ignore */
    }
  }

  var account = loadAccount();

  // ---- House preview ownership (fixed-price + resale) ----------------------
  // ownership[id] = { status: 'owned' | 'listed', listPrice: number|null }.
  // Absent id ⇒ unowned. Local preview only.
  function loadHouses() {
    try {
      var raw = localStorage.getItem(HOUSES_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
      return {};
    }
  }
  function saveHouses(h) {
    try {
      localStorage.setItem(HOUSES_KEY, JSON.stringify(h));
    } catch (err) {
      /* ignore */
    }
  }

  var ownership = loadHouses();
  // Drop entries for plots no longer present.
  Object.keys(ownership).forEach(function (id) {
    if (!houseById[id]) delete ownership[id];
  });

  function houseStatus(h) {
    var o = ownership[h.id];
    return o ? o.status : "unowned";
  }

  // ---- Account form (account.html) -----------------------------------------
  function populateWorldSelect() {
    var sel = $("#char-world");
    if (!sel || sel.dataset.built === "1") return;
    WORLDS.forEach(function (w) {
      var opt = document.createElement("option");
      opt.value = w.id;
      opt.textContent = w.name + " — " + w.type + " · " + w.region + " · " + w.stage;
      if (w.stage === "Planned") opt.disabled = true;
      sel.appendChild(opt);
    });
    sel.dataset.built = "1";
  }

  function renderAccountView() {
    var wrap = $("#account-form-wrap");
    var summary = $("#account-summary");
    if (account) {
      if (wrap) wrap.hidden = true;
      if (summary) {
        summary.hidden = false;
        var w = worldById[account.world];
        setText("#summary-name", account.name);
        setText("#summary-sex", account.sex === "female" ? "Female" : "Male");
        setText("#summary-world", w ? w.name : account.world);
        setText("#summary-gold", fmt(account.goldBalance));
        setText("#summary-premium", account.premium ? "Active" : "Standard");
      }
    } else {
      if (wrap) wrap.hidden = false;
      if (summary) summary.hidden = true;
    }
  }

  function onAccountSubmit(e) {
    e.preventDefault();
    var nameEl = $("#char-name");
    var worldEl = $("#char-world");
    var sexEl = document.querySelector('input[name="sex"]:checked');
    var ok = true;

    var name = nameEl ? nameEl.value.trim() : "";
    if (!/^[A-Za-z][A-Za-z '\-]{1,19}$/.test(name)) {
      setErr("err-name", "Use 2–20 letters (spaces, apostrophe and hyphen allowed).");
      ok = false;
    } else {
      setErr("err-name", "");
    }

    if (!sexEl) {
      setErr("err-sex", "Choose a sex.");
      ok = false;
    } else {
      setErr("err-sex", "");
    }

    var worldId = worldEl ? worldEl.value : "";
    if (!worldId || !worldById[worldId]) {
      setErr("err-world", "Choose a world.");
      ok = false;
    } else if (worldById[worldId].stage === "Planned") {
      setErr("err-world", "That world isn't open yet.");
      ok = false;
    } else {
      setErr("err-world", "");
    }

    if (!ok) return;

    account = {
      name: name,
      sex: sexEl.value,
      world: worldId,
      goldBalance: START_GOLD,
      premium: false,
      createdAt: new Date().toISOString(),
    };
    saveAccount(account);
    renderAccountView();
    renderHoldings();
    applyAccountGates();
    renderHouses();
    alert(
      "Preview character created — " +
        name +
        " on " +
        worldById[worldId].name +
        ".\n\nThis is a local preview only. No real account, world transfer, " +
        "or game data is created."
    );
  }

  function initAccount() {
    var form = $("#account-form");
    var summary = $("#account-summary");
    if (!form && !summary) return; // not the account page
    populateWorldSelect();
    renderAccountView();
    if (form) form.addEventListener("submit", onAccountSubmit);
    var reset = $("#account-reset");
    if (reset) {
      reset.addEventListener("click", function () {
        if (confirm("Start over? This clears your local preview character.")) {
          clearAccount();
          account = null;
          renderAccountView();
          renderHoldings();
          applyAccountGates();
        }
      });
    }
  }

  // ---- Sidebar holdings (all pages) ----------------------------------------
  function renderHoldings() {
    var panel = $("#holdings-panel");
    if (!panel) return;
    var empty = $("#holdings-empty");
    var body = $("#holdings-body");
    if (account) {
      if (empty) empty.hidden = true;
      if (body) body.hidden = false;
      var w = worldById[account.world];
      setText("#holdings-name", account.name);
      setText("#holdings-world", w ? w.name : account.world);
      setText("#holdings-gold", fmt(account.goldBalance));
      setText("#holdings-premium", account.premium ? "Active" : "Standard");
    } else {
      if (empty) empty.hidden = false;
      if (body) body.hidden = true;
    }
  }

  // ---- Account gating (Houses & Shop require a character) ------------------
  // Preview only: a "logged-in character" is a local account in localStorage.
  // Hides gated nav links and gated page content when no character exists.
  function applyAccountGates() {
    var loggedIn = !!account;
    $all(".requires-account").forEach(function (el) {
      el.hidden = !loggedIn;
    });
    if (document.body && document.body.hasAttribute("data-requires-account")) {
      var gate = $("#account-required");
      var content = $("#gated-content");
      if (gate) gate.hidden = loggedIn;
      if (content) content.hidden = !loggedIn;
    }
  }

  // ---- House preview: fixed-price buy + resale (houses.html) ---------------
  // Mirrors the supported server model. Auctions are NOT here (planned only).
  function houseCardHtml(h) {
    var status = houseStatus(h);
    var o = ownership[h.id];
    var statusLabel =
      status === "owned"
        ? "Owned by you (preview)"
        : status === "listed"
        ? "Listed for resale (preview)"
        : "Available";

    var action;
    if (status === "unowned") {
      action =
        '<button class="btn btn-gold btn-block" data-buy="' + h.id + '">Buy — ' +
        fmt(h.priceGold) + " gold</button>" +
        '<p class="field-error" id="house-error-' + h.id + '" aria-live="polite"></p>';
    } else if (status === "owned") {
      action =
        '<form class="resale-row" data-list="' + h.id + '" novalidate>' +
        '<label class="resale-label" for="price-' + h.id + '">Resale price (gold)</label>' +
        '<div class="resale-controls">' +
        '<input class="resale-input" type="number" id="price-' + h.id + '" name="price" min="1" inputmode="numeric" placeholder="e.g. ' +
        h.priceGold + '" />' +
        '<button class="btn btn-gold" type="submit">List for resale</button>' +
        "</div>" +
        '<p class="field-error" id="house-error-' + h.id + '" aria-live="polite"></p>' +
        "</form>";
    } else {
      action =
        '<p class="resale-note">Listed at <span class="gold">' + fmt(o.listPrice) +
        "</span> gold. Another character could buy it at this price (preview).</p>" +
        '<button class="btn btn-ghost btn-block" data-unlist="' + h.id + '">Unlist (preview)</button>';
    }

    return (
      '<header class="house-head">' +
      '<h3 class="house-name">' + h.name + "</h3>" +
      '<span class="house-world">' + h.world + " · " + h.district + "</span>" +
      "</header>" +
      '<dl class="house-meta">' +
      '<div><dt>Plot</dt><dd class="house-coords">' + h.coords + "</dd></div>" +
      '<div><dt>Price</dt><dd><span class="gold">' + fmt(h.priceGold) + "</span> gold</dd></div>" +
      "<div><dt>Status</dt><dd>" + statusLabel + "</dd></div>" +
      "</dl>" +
      '<div class="house-bid">' +
      action +
      "</div>"
    );
  }

  function renderOneHouse(h) {
    var grid = $("#houses-grid");
    if (!grid) return;
    var card = grid.querySelector('[data-house="' + h.id + '"]');
    if (card) card.innerHTML = houseCardHtml(h);
  }

  function buyHouse(id) {
    var h = houseById[id];
    if (!h) return;
    var errId = "house-error-" + id;
    if (!account) {
      setErr(errId, "Create a character first.");
      return;
    }
    if (houseStatus(h) !== "unowned") return;
    if (account.goldBalance < h.priceGold) {
      setErr(errId, "Not enough preview gold (need " + fmt(h.priceGold) + ").");
      return;
    }
    // Primary purchase is a gold sink in the real model — mirror that here.
    account.goldBalance -= h.priceGold;
    saveAccount(account);
    ownership[id] = { status: "owned", listPrice: null };
    saveHouses(ownership);
    renderOneHouse(h);
    renderHoldings();
  }

  function listHouse(id, raw) {
    var h = houseById[id];
    if (!h) return;
    var errId = "house-error-" + id;
    if (houseStatus(h) !== "owned") return;
    var price = parseInt(String(raw).trim(), 10);
    if (!price || isNaN(price) || price < 1) {
      setErr(errId, "Enter a resale price in gold.");
      return;
    }
    if (price > 1000000) {
      setErr(errId, "Max 1,000,000 gold.");
      return;
    }
    ownership[id] = { status: "listed", listPrice: price };
    saveHouses(ownership);
    renderOneHouse(h);
  }

  function unlistHouse(id) {
    var h = houseById[id];
    if (!h) return;
    if (houseStatus(h) !== "listed") return;
    ownership[id] = { status: "owned", listPrice: null };
    saveHouses(ownership);
    renderOneHouse(h);
  }

  function onHousesClick(e) {
    var buy = e.target.closest ? e.target.closest("[data-buy]") : null;
    if (buy) {
      buyHouse(buy.getAttribute("data-buy"));
      return;
    }
    var unlist = e.target.closest ? e.target.closest("[data-unlist]") : null;
    if (unlist) {
      unlistHouse(unlist.getAttribute("data-unlist"));
    }
  }

  function onHousesSubmit(e) {
    var form = e.target.closest ? e.target.closest("[data-list]") : null;
    if (!form) return;
    e.preventDefault();
    var id = form.getAttribute("data-list");
    var input = form.querySelector('input[name="price"]');
    listHouse(id, input ? input.value : "");
  }

  function renderHouses() {
    var grid = $("#houses-grid");
    if (!grid) return;
    if (grid.dataset.wired !== "1") {
      grid.addEventListener("click", onHousesClick);
      grid.addEventListener("submit", onHousesSubmit);
      grid.dataset.wired = "1";
    }
    grid.innerHTML = "";
    HOUSES.forEach(function (h) {
      var card = document.createElement("article");
      card.className = "house-card";
      card.setAttribute("data-house", h.id);
      card.innerHTML = houseCardHtml(h);
      grid.appendChild(card);
    });
  }

  function initHouses() {
    var grid = $("#houses-grid");
    if (!grid) return; // not the houses page
    renderHouses();
  }

  // ---- Year + boot ---------------------------------------------------------
  function initMisc() {
    var y = $("#year");
    if (y) y.textContent = new Date().getFullYear();
  }

  function boot() {
    initTabs();
    initCart();
    initAccount();
    initHouses();
    renderHoldings();
    applyAccountGates();
    initMisc();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
