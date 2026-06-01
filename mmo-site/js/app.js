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

  // ---- House preview auctions ----------------------------------------------
  // Houses use PREVIEW GOLD, distinct from the shop's premium Azura coins.
  // Plots are grounded in docs/WORLD_AZURA.md (the Azura residential row, plots
  // H1-H3, just below the Guild Hall). INVARIANT: gold and bids are local
  // preview state only -- they do not prove ownership, reserve a house, spend
  // real account currency, or affect live game state. No settlement, no proof.
  var ACCOUNT_KEY = "akalynth.account.v1";
  var BIDS_KEY = "akalynth.bids.v1";
  var BID_INCREMENT = 1000; // minimum gold step over the current top bid
  var START_GOLD = 50000; // preview starting balance for a new character

  // endsAt is set relative to load (no backend to anchor a real clock).
  var HOUR = 3600 * 1000;
  var now = Date.now();
  var HOUSES = [
    {
      id: "azura-h1",
      name: "Plaza Row Cottage",
      world: "Azura",
      district: "Residential Row",
      coords: "(10, 32)",
      sizeTiles: 4,
      rentGold: 800,
      topBidGold: 22000,
      topBidder: "Brannic",
      endsAt: now + 48 * HOUR,
    },
    {
      id: "azura-h2",
      name: "Guildside House",
      world: "Azura",
      district: "Residential Row",
      coords: "(14, 32)",
      sizeTiles: 4,
      rentGold: 950,
      topBidGold: 31000,
      topBidder: "Sera of the Vale",
      endsAt: now + 18 * HOUR,
    },
    {
      id: "azura-h3",
      name: "Lantern Walk Home",
      world: "Azura",
      district: "Residential Row",
      coords: "(18, 32)",
      sizeTiles: 4,
      rentGold: 1100,
      topBidder: "Olwin Reed",
      topBidGold: 28000,
      endsAt: now + 5 * HOUR,
    },
    {
      id: "azura-h4",
      name: "Plaza Overlook",
      world: "Azura",
      district: "Central Plaza edge",
      coords: "(24, 46)",
      sizeTiles: 9,
      rentGold: 1800,
      topBidGold: 45000,
      topBidder: "Maren Dusk",
      endsAt: now + 30 * HOUR,
    },
    {
      id: "azura-h5",
      name: "Old Gatehouse Flat",
      world: "Azura",
      district: "Northern Wall",
      coords: "(8, 14)",
      sizeTiles: 6,
      rentGold: 1300,
      topBidder: "—",
      topBidGold: 19000,
      endsAt: now - 2 * HOUR, // already closed: demonstrates the ended state
    },
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
        // Buying Premium Time grants preview premium, which unlocks house
        // bidding. Preview only — no real entitlement is created.
        if (cartHasPremium()) {
          if (account) {
            account.premium = true;
            saveAccount(account);
            renderHoldings();
            msg += "\n\nPreview Premium activated — you can now bid on houses.";
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

  // ---- Preview bids --------------------------------------------------------
  function loadBids() {
    try {
      var raw = localStorage.getItem(BIDS_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
      return {};
    }
  }
  function saveBids(b) {
    try {
      localStorage.setItem(BIDS_KEY, JSON.stringify(b));
    } catch (err) {
      /* ignore */
    }
  }

  var bids = loadBids();
  // Drop bids for houses no longer listed.
  Object.keys(bids).forEach(function (id) {
    if (!houseById[id]) delete bids[id];
  });

  // ---- Auction helpers -----------------------------------------------------
  function currentTop(house) {
    return Math.max(house.topBidGold, bids[house.id] || 0);
  }
  function minNextBid(house) {
    return currentTop(house) + BID_INCREMENT;
  }
  function isMine(house) {
    var mine = bids[house.id] || 0;
    return mine > 0 && mine >= house.topBidGold;
  }
  function isEnded(house) {
    return Date.now() >= house.endsAt;
  }
  function fmtCountdown(ms) {
    if (ms <= 0) return "Auction ended";
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400);
    s -= d * 86400;
    var h = Math.floor(s / 3600);
    s -= h * 3600;
    var m = Math.floor(s / 60);
    var parts = [];
    if (d) parts.push(d + "d");
    parts.push(h + "h");
    parts.push(m + "m");
    return parts.join(" ") + " left";
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

  // ---- House preview auctions (houses.html) --------------------------------
  function houseCardHtml(h, hasAccount) {
    var top = currentTop(h);
    var ended = isEnded(h);
    var mine = isMine(h);

    var statusHtml = "";
    if (ended) {
      statusHtml = mine
        ? '<p class="house-status is-won">Auction ended — you held the top preview bid.</p>'
        : '<p class="house-status is-ended">Auction ended.</p>';
    } else if (mine) {
      statusHtml = '<p class="house-status is-high">You hold the top preview bid.</p>';
    }

    var action;
    if (ended) {
      action = '<button class="btn btn-ghost btn-block" disabled>Bidding closed</button>';
    } else if (!hasAccount) {
      action =
        '<a class="btn btn-ghost btn-block" href="account.html">Create a character to bid</a>';
    } else if (!account.premium) {
      action =
        '<a class="btn btn-ghost btn-block" href="shop.html">Premium required to bid</a>';
    } else {
      var min = minNextBid(h);
      action =
        '<form class="bid-row" data-bid="' + h.id + '" novalidate>' +
        '<label class="bid-input-label" for="bid-' + h.id + '">Your preview bid (gold)</label>' +
        '<div class="bid-controls">' +
        '<input class="bid-input" type="number" id="bid-' + h.id + '" name="bid" min="' + min +
        '" step="' + BID_INCREMENT + '" inputmode="numeric" placeholder="' + min + '" />' +
        '<button class="btn btn-gold" type="submit">Place bid</button>' +
        "</div>" +
        '<p class="field-error" id="bid-error-' + h.id + '" aria-live="polite"></p>' +
        '<p class="bid-hint">Min next bid <span class="gold">' + fmt(min) +
        '</span> gold · your preview balance <span class="gold">' +
        fmt(account ? account.goldBalance : 0) + "</span> gold</p>" +
        "</form>";
    }

    return (
      '<header class="house-head">' +
      '<h3 class="house-name">' + h.name + "</h3>" +
      '<span class="house-world">' + h.world + " · " + h.district + "</span>" +
      "</header>" +
      '<dl class="house-meta">' +
      "<div><dt>Plot</dt><dd class=\"house-coords\">" + h.coords + "</dd></div>" +
      "<div><dt>Size</dt><dd>" + h.sizeTiles + " tiles</dd></div>" +
      '<div><dt>Rent</dt><dd><span class="gold">' + fmt(h.rentGold) + "</span> gold/mo</dd></div>" +
      "</dl>" +
      '<div class="house-bid">' +
      '<div class="bid-line">' +
      '<span class="bid-label">Top preview bid</span>' +
      '<span class="bid-amount"><span class="gold">' + fmt(top) + "</span> gold</span>" +
      "</div>" +
      '<p class="countdown" data-ends="' + h.endsAt + '"' + (ended ? ' data-ended="1"' : "") +
      ' aria-live="polite">' + fmtCountdown(h.endsAt - Date.now()) + "</p>" +
      statusHtml +
      action +
      "</div>"
    );
  }

  function renderOneHouse(h) {
    var grid = $("#houses-grid");
    if (!grid) return;
    var card = grid.querySelector('[data-house="' + h.id + '"]');
    if (card) card.innerHTML = houseCardHtml(h, !!account);
  }

  function onBidSubmit(e) {
    var form = e.target.closest ? e.target.closest("[data-bid]") : null;
    if (!form) return;
    e.preventDefault();
    var id = form.getAttribute("data-bid");
    var h = houseById[id];
    if (!h) return;
    var errId = "bid-error-" + id;

    if (!account) {
      setErr(errId, "Create a character to place a preview bid.");
      return;
    }
    if (!account.premium) {
      setErr(errId, "Premium required to bid — get Premium Time in the Shop.");
      return;
    }
    if (isEnded(h)) {
      setErr(errId, "This auction has ended.");
      return;
    }
    var input = form.querySelector(".bid-input");
    var raw = input ? input.value.trim() : "";
    var amount = parseInt(raw, 10);
    if (!raw || isNaN(amount)) {
      setErr(errId, "Enter a bid amount in gold.");
      return;
    }
    var min = minNextBid(h);
    if (amount < min) {
      setErr(errId, "Bid must be at least " + fmt(min) + " gold.");
      return;
    }
    if (amount > account.goldBalance) {
      setErr(errId, "That exceeds your preview gold balance (" + fmt(account.goldBalance) + ").");
      return;
    }
    bids[id] = amount;
    saveBids(bids);
    renderOneHouse(h);
  }

  function renderHousesGate() {
    var gate = $("#houses-gate");
    if (!gate) return;
    if (!account) {
      gate.hidden = false;
      gate.innerHTML =
        "<p><strong>Create a character first.</strong> You can browse the plots " +
        "below, but placing a preview bid needs a local character. " +
        '<a href="account.html">Create your character →</a></p>';
    } else if (!account.premium) {
      gate.hidden = false;
      gate.innerHTML =
        "<p><strong>Premium required.</strong> Only Premium adventurers can bid on " +
        "houses. Get <strong>Premium Time</strong> in the " +
        '<a href="shop.html">Shop</a> (preview) to unlock bidding.</p>';
    } else {
      gate.hidden = true;
    }
  }

  function renderHouses() {
    var grid = $("#houses-grid");
    if (!grid) return;
    renderHousesGate();
    if (grid.dataset.wired !== "1") {
      grid.addEventListener("submit", onBidSubmit);
      grid.dataset.wired = "1";
    }
    grid.innerHTML = "";
    HOUSES.forEach(function (h) {
      var card = document.createElement("article");
      card.className = "house-card";
      card.setAttribute("data-house", h.id);
      card.innerHTML = houseCardHtml(h, !!account);
      grid.appendChild(card);
    });
  }

  function tickCountdowns() {
    $all(".countdown[data-ends]").forEach(function (el) {
      var ends = parseInt(el.getAttribute("data-ends"), 10);
      var left = ends - Date.now();
      el.textContent = fmtCountdown(left);
      if (left <= 0 && el.getAttribute("data-ended") !== "1") {
        var card = el.closest(".house-card");
        var id = card ? card.getAttribute("data-house") : null;
        if (id && houseById[id]) renderOneHouse(houseById[id]);
      }
    });
  }

  function initHouses() {
    var grid = $("#houses-grid");
    if (!grid) return; // not the houses page
    renderHouses();
    tickCountdowns();
    setInterval(tickCountdowns, 30000);
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
