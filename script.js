// ===== CONFIG =====
const API = ["localhost", "127.0.0.1", "foundit-box.local"].includes(window.location.hostname)
  ? `${window.location.protocol}//${window.location.hostname}:5000/api`
  : `${window.location.protocol}//${window.location.host}/api`;

// ===== HELPERS =====
function getToken() { return localStorage.getItem("foundItBoxToken"); }
function setToken(t) { localStorage.setItem("foundItBoxToken", t); }
function clearToken() { localStorage.removeItem("foundItBoxToken"); }

async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  const token = getToken();
  if (token) opts.headers["Authorization"] = "Bearer " + token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

// ===== DARK MODE =====
function toggleDark() {
  const isDark = document.body.classList.toggle("dark");
  document.querySelector("#darkToggle i").className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
  localStorage.setItem("darkMode", isDark);
}

// ===== STATE =====
let currentUser = null;
let items = [];
let notifications = [];
let conversations = [];
let activeFilter = "all";
let activeConvo = null;
let pendingItemImg = null;

function getInitials(first, last) { return (first[0] + (last[0] || "")).toUpperCase(); }

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark");
    const icon = document.querySelector("#darkToggle i");
    if (icon) icon.className = "fa-solid fa-sun";
  }

  document.querySelectorAll(".auth-tab-btn").forEach(btn =>
    btn.addEventListener("click", () => showAuthTab(btn.dataset.tab))
  );

  document.getElementById("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
    try {
      const email = document.getElementById("loginEmail").value.trim().toLowerCase();
      const password = document.getElementById("loginPassword").value;
      const data = await api("POST", "/auth/login", { email, password });
      setToken(data.token);
      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
      await bootApp(data.user);
    } catch (err) {
      showToast(err.message, "error");
      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
    }
  });

  document.getElementById("registerForm").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account...';
    try {
      const first = document.getElementById("regFirst").value.trim();
      const last = document.getElementById("regLast").value.trim();
      const email = document.getElementById("regEmail").value.trim().toLowerCase();
      const password = document.getElementById("regPassword").value;
      const confirm = document.getElementById("regConfirmPassword").value;
      if (password !== confirm) { showToast("Passwords do not match", "error"); btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account'; return; }
      if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
        showToast("Password must be 8+ characters, include a capital letter and a number", "error"); btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account'; return;
      }
      const data = await api("POST", "/auth/register", { first, last, email, password });
      setToken(data.token);
      await bootApp(data.user);
      showToast(`Welcome, ${first}!`, "success");
    } catch (err) {
      showToast(err.message, "error");
      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
    }
  });

  document.getElementById("forgotForm").addEventListener("submit", async e => {
    e.preventDefault();
    try {
      const email = document.getElementById("forgotEmail").value.trim().toLowerCase();
      const data = await api("POST", "/auth/forgot-password", { email });
      showToast("Reset token generated — copy it below", "success");
      // Show token so user can copy it
      document.getElementById("resetToken").value = data.resetToken;
      showAuthTab("reset");
    } catch (err) { showToast(err.message, "error"); }
  });

  document.getElementById("resetForm").addEventListener("submit", async e => {
    e.preventDefault();
    try {
      const token = document.getElementById("resetToken").value.trim();
      const password = document.getElementById("resetPassword").value;
      if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
        showToast("Password must be 8+ characters, include a capital letter and a number", "error"); return;
      }
      await api("POST", "/auth/reset-password", { token, password });
      showToast("Password reset! Please sign in.", "success");
      showAuthTab("login");
    } catch (err) { showToast(err.message, "error"); }
  });

  // Auto-login if token exists
  if (getToken()) {
    api("GET", "/auth/me").then(user => bootApp(user)).catch(() => {
      clearToken();
      showAuth();
    });
  } else {
    showAuth();
  }
});

// ===== AUTH UI =====
function showAuth() {
  document.getElementById("authPage").classList.remove("hidden");
  document.getElementById("appLayout").classList.add("hidden");
}

function showAuthTab(tab) {
  ["loginTab","registerTab","forgotTab","resetTab"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("hidden", id !== tab + "Tab");
  });
  document.querySelectorAll(".auth-tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
}

function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  btn.querySelector("i").className = isHidden ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
}

async function logout() {
  clearToken();
  currentUser = null;
  items = []; notifications = []; conversations = [];
  document.getElementById("appLayout").classList.add("hidden");
  showAuth();
  showAuthTab("login");
  showToast("Signed out", "info");
}

function applyVerificationRestrictions() {
  const isRestricted = !currentUser.verified && currentUser.role !== "admin";
  document.getElementById("unverifiedBanner").classList.toggle("hidden", !isRestricted);

  const restrictedSections = ["listings", "report", "chat", "notifications"];
  restrictedSections.forEach(id => {
    const section = document.getElementById("section-" + id);
    if (!section) return;
    // Remove existing lock if any
    const existing = section.querySelector(".section-lock");
    if (existing) existing.remove();
    if (isRestricted) {
      section.classList.add("locked");
      const lock = document.createElement("div");
      lock.className = "section-lock";
      lock.innerHTML = `<i class="fa-solid fa-lock"></i><p>Your account is pending admin approval. You cannot access this section yet.</p>`;
      section.appendChild(lock);
    } else {
      section.classList.remove("locked");
    }
  });
}

// ===== BOOT =====
async function bootApp(user) {
  currentUser = user;

  // Hide pending page if showing
  document.getElementById("pendingPage").classList.add("hidden");
  updateProfileUI();
  document.getElementById("authPage").classList.add("hidden");
  document.getElementById("appLayout").classList.remove("hidden");

  // Show admin nav if admin, hide non-admin items for admin
  document.querySelectorAll(".admin-only").forEach(el =>
    el.classList.toggle("hidden", currentUser.role !== "admin")
  );
  document.querySelectorAll(".non-admin-only").forEach(el =>
    el.classList.toggle("hidden", currentUser.role === "admin")
  );

  // Apply restrictions for unverified users
  applyVerificationRestrictions();
  loadProfileForm();
  setDefaultDate();
  setupEventListeners();

  // Render empty state immediately
  renderAll();
  updateBadges();

  const isRestricted = !currentUser.verified && currentUser.role !== "admin";
  const results = await Promise.allSettled([
    isRestricted ? Promise.resolve([]) : api("GET", "/items"),
    isRestricted ? Promise.resolve([]) : api("GET", "/notifications"),
    isRestricted ? Promise.resolve([]) : api("GET", "/conversations"),
  ]);
  items = results[0].status === "fulfilled" ? results[0].value : [];
  notifications = results[1].status === "fulfilled" ? results[1].value : [];
  conversations = results[2].status === "fulfilled" ? results[2].value : [];

  updateProfileUI();
  renderAll();
  updateBadges();
}
// ===== PROFILE =====
function loadProfileForm() {
  if (!currentUser) return;
  document.getElementById("pFirst").value = currentUser.first || "";
  document.getElementById("pLast").value = currentUser.last || "";
  document.getElementById("pEmail").value = currentUser.email || "";
  document.getElementById("pPhone").value = currentUser.phone || "";
  document.getElementById("pBio").value = currentUser.bio || "";
  document.getElementById("pLocation").value = currentUser.location || "";
  document.getElementById("pNewPw").value = "";
  document.getElementById("pConfirmPw").value = "";
}

function updateProfileUI() {
  if (!currentUser) return;
  const initials = getInitials(currentUser.first, currentUser.last);
  const fullName = `${currentUser.first} ${currentUser.last}`;
  document.getElementById("sidebarName").textContent = fullName;
  document.getElementById("profileDisplayName").textContent = fullName;

  // Verified status
  const isVerified = currentUser.verified === true;
  const roleEl = document.getElementById("sidebarRole");
  if (roleEl) roleEl.innerHTML = isVerified
    ? `<i class="fa-solid fa-circle-check" style="color:var(--success)"></i> Verified User`
    : `<i class="fa-solid fa-circle-xmark" style="color:#ef4444"></i> Unverified`;
  const profileRoleEl = document.getElementById("profileRole");
  if (profileRoleEl) profileRoleEl.innerHTML = isVerified
    ? `<i class="fa-solid fa-circle-check" style="color:var(--success)"></i> Verified User`
    : `<i class="fa-solid fa-circle-xmark" style="color:#ef4444"></i> Unverified`;

  ["profileAvatarDisplay", "profileAvatarEdit"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = currentUser.avatar
      ? `<img src="${currentUser.avatar}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`
      : initials;
  });
  const sidebarAv = document.getElementById("sidebarAvatar");
  if (sidebarAv) sidebarAv.innerHTML = currentUser.avatar
    ? `<img src="${currentUser.avatar}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`
    : initials;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || "—"; };
  set("viewEmail", currentUser.email);
  set("viewPhone", currentUser.phone);
  set("viewLocation", currentUser.location);
  set("viewBio", currentUser.bio);
  const myItems = items.filter(i => i.postedBy === currentUser._id || i.postedBy?._id === currentUser._id);
  document.getElementById("pStatReported").textContent = myItems.length;
  document.getElementById("pStatReturned").textContent = myItems.filter(i => i.status === "Returned").length;
}

function toggleProfileEdit(show) {
  document.getElementById("profileView").classList.toggle("hidden", show);
  document.getElementById("profileEdit").classList.toggle("hidden", !show);
  document.getElementById("editProfileBtn").classList.toggle("hidden", show);
  if (show) loadProfileForm();
}

let listenersAttached = false;

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  // Profile save
  document.getElementById("profileForm").addEventListener("submit", async e => {
    e.preventDefault();
    const newPw = document.getElementById("pNewPw").value;
    const confirmPw = document.getElementById("pConfirmPw").value;
    if (newPw && newPw !== confirmPw) { showToast("Passwords do not match", "error"); return; }
    try {
      const body = {
        first: document.getElementById("pFirst").value.trim(),
        last: document.getElementById("pLast").value.trim(),
        email: document.getElementById("pEmail").value.trim(),
        phone: document.getElementById("pPhone").value.trim(),
        bio: document.getElementById("pBio").value.trim(),
        location: document.getElementById("pLocation").value.trim(),
        avatar: currentUser.avatar,
      };
      if (newPw) body.password = newPw;
      currentUser = await api("PUT", "/auth/profile", body);
      updateProfileUI();
      showToast("Profile updated", "success");
      toggleProfileEdit(false);
    } catch (err) { showToast(err.message, "error"); }
  });

  // Avatar upload
  document.getElementById("avatarUpload").addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        currentUser = await api("PUT", "/auth/profile", { ...currentUser, avatar: ev.target.result });
        updateProfileUI();
        showToast("Avatar updated", "success");
      } catch (err) { showToast(err.message, "error"); }
    };
    reader.readAsDataURL(file);
  });

  // Report form
  const form = document.getElementById("reportForm");
  if (form) {
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const btn = form.querySelector("button[type=submit]");
      if (btn.disabled) return;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
      try {
        const newItem = await api("POST", "/items", {
          name: document.getElementById("fName").value.trim(),
          status: document.getElementById("fStatus").value,
          category: document.getElementById("fCategory").value,
          location: document.getElementById("fLocation").value.trim(),
          desc: document.getElementById("fDesc").value.trim(),
          date: document.getElementById("fDate").value,
          email: document.getElementById("fEmail").value.trim(),
          img: pendingItemImg || null,
        });
        items.unshift(newItem);
        notifications = await api("GET", "/notifications");
        renderAll();
        updateProfileUI();
        form.reset();
        pendingItemImg = null;
        document.getElementById("imagePreview").classList.add("hidden");
        setDefaultDate();
        navigate("listings");
        showToast(`"${newItem.name}" reported & verified`, "success");
        updateBadges();
      } catch (err) { showToast(err.message, "error"); }
      finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Report';
      }
    });
  }

  // Upload area
  const uploadArea = document.getElementById("uploadArea");
  const fileInput = document.getElementById("fImage");
  if (uploadArea && fileInput) {
    uploadArea.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        pendingItemImg = e.target.result;
        const preview = document.getElementById("imagePreview");
        preview.innerHTML = `<img src="${e.target.result}" alt="Preview" />`;
        preview.classList.remove("hidden");
      };
      reader.readAsDataURL(file);
    });
    uploadArea.addEventListener("dragover", e => { e.preventDefault(); uploadArea.style.borderColor = "var(--accent)"; });
    uploadArea.addEventListener("dragleave", () => { uploadArea.style.borderColor = ""; });
    uploadArea.addEventListener("drop", e => {
      e.preventDefault(); uploadArea.style.borderColor = "";
      fileInput.files = e.dataTransfer.files;
      fileInput.dispatchEvent(new Event("change"));
    });
  }

  // Sidebar nav
  document.querySelectorAll(".nav-item").forEach(item =>
    item.addEventListener("click", e => { e.preventDefault(); navigate(item.dataset.section); })
  );
  document.getElementById("menuToggle").addEventListener("click", () =>
    document.getElementById("sidebar").classList.toggle("open")
  );
  document.querySelectorAll(".filter-btn").forEach(btn =>
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      renderItems(getFilteredItems());
    })
  );
  document.getElementById("categoryFilter").addEventListener("change", () => renderItems(getFilteredItems()));
  document.getElementById("globalSearch").addEventListener("input", () => renderItems(getFilteredItems()));
  document.getElementById("itemModal").addEventListener("click", e => {
    if (e.target === document.getElementById("itemModal")) closeModal();
  });
  document.getElementById("chatSearch").addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll(".convo-item").forEach((el, i) => {
      el.style.display = (conversations[i]?.item || "").toLowerCase().includes(q) ? "" : "none";
    });
  });
}

// ===== RENDER ALL =====
function renderAll() {
  renderStats(); renderRecentActivity(); renderMatches();
  renderItems(items); renderNotifications(); renderConversations(); renderClaims();
}

function navigate(section) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("section-" + section).classList.add("active");
  const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
  if (navItem) navItem.classList.add("active");
  document.getElementById("sidebar").classList.remove("open");
  if (section === "admin") loadAdminPanel();
  if (section === "subscription") loadSubscription();
}

function renderStats() {
  document.getElementById("statTotal").textContent = items.length;
  document.getElementById("statLost").textContent = items.filter(i => i.status === "Lost").length;
  document.getElementById("statFound").textContent = items.filter(i => i.status === "Found").length;
  document.getElementById("statReturned").textContent = items.filter(i => i.status === "Returned").length;
  api("GET", "/items/claims-count").then(data => {
    document.getElementById("statClaims").textContent = data.total;
  }).catch(() => {});
}

function renderRecentActivity() {
  const el = document.getElementById("recentActivity");
  const recent = [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  if (!recent.length) { el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>No activity yet</p></div>`; return; }
  el.innerHTML = recent.map(item => `
    <div class="activity-item" onclick="openModal('${item._id}')" style="cursor:pointer">
      <div class="activity-dot ${item.status.toLowerCase()}"></div>
      <div><strong>${item.name}</strong><div class="text-muted" style="font-size:0.78rem">${item.location}</div></div>
      <span class="activity-meta">${item.date}</span>
      <span class="status-tag ${item.status}">${item.status}</span>
    </div>`).join("");
}

function renderMatches() {
  const el = document.getElementById("matchList");
  const myId = currentUser._id;
  const myItems = items.filter(i => (i.postedBy?._id || i.postedBy)?.toString() === myId);
  const otherItems = items.filter(i => (i.postedBy?._id || i.postedBy)?.toString() !== myId);
  const matches = [];
  myItems.forEach(mine => {
    const opp = mine.status === "Lost" ? "Found" : "Lost";
    otherItems.filter(o => o.status === opp && o.category === mine.category)
      .forEach(other => matches.push({ mine, other }));
  });
  if (!matches.length) { el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-link-slash"></i><p>No matches yet</p></div>`; return; }
  el.innerHTML = matches.slice(0, 4).map(m => `
    <div class="match-item" onclick="openModal('${m.other._id}')" style="cursor:pointer">
      <div>
        <div style="font-weight:600;font-size:0.88rem">${m.mine.name} (${m.mine.status})</div>
        <div style="font-size:0.78rem;color:var(--text-muted)">may match → ${m.other.name} by ${m.other.postedByName || "another user"}</div>
      </div>
      <span class="match-score">High Match</span>
    </div>`).join("");
}

const categoryIcons = {
  Electronics: "fa-mobile-screen", Clothing: "fa-shirt", Accessories: "fa-glasses",
  Documents: "fa-file-lines", Keys: "fa-key", Bags: "fa-bag-shopping", Other: "fa-box"
};

function renderItems(list) {
  const grid = document.getElementById("itemsGrid");
  if (!list.length) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fa-solid fa-box-open"></i><p>No items found</p></div>`; return; }
  grid.innerHTML = list.map(item => `
    <div class="item-card" onclick="openModal('${item._id}')">
      <div class="item-card-img">
        ${item.img ? `<img src="${item.img}" alt="${item.name}" />` : `<i class="fa-solid ${categoryIcons[item.category] || "fa-box"}"></i>`}
      </div>
      <div class="item-card-body">
        <div class="item-card-top">
          <span class="item-card-name">${item.name}</span>
          <span class="status-tag ${item.status}">${item.status}</span>
        </div>
        <div class="item-card-meta">
          <span><i class="fa-solid fa-location-dot"></i>${item.location}</span>
          <span><i class="fa-solid fa-calendar"></i>${item.date}</span>
          <span><i class="fa-solid fa-tag"></i>${item.category}</span>
        </div>
      </div>
      <div class="item-card-footer">
        <span class="verified-badge"><i class="fa-solid fa-circle-check"></i> Verified</span>
        <button class="btn-outline btn-sm" style="margin-left:auto" onclick="event.stopPropagation();openModal('${item._id}')">View</button>
      </div>
    </div>`).join("");
}

function getFilteredItems() {
  const cat = document.getElementById("categoryFilter").value;
  const search = document.getElementById("globalSearch").value.toLowerCase();
  return items.filter(item => {
    const statusMatch = activeFilter === "all" || item.status === activeFilter;
    const catMatch = !cat || item.category === cat;
    const searchMatch = !search || item.name.toLowerCase().includes(search) || item.location.toLowerCase().includes(search);
    return statusMatch && catMatch && searchMatch;
  });
}

// ===== MODAL =====
async function openModal(id) {
  // Use cached item first, only fetch from API if not in cache or needs claims
  let item = items.find(i => i._id === id);
  if (!item || !item.claims) {
    item = await api("GET", `/items/${id}`).catch(() => item);
  }
  if (!item) return;
  const myId = currentUser._id;
  const isOwner = (item.postedBy?._id || item.postedBy) === myId;
  const isVerified = currentUser.verified === true;
  const canMarkReceived = isOwner && item.status === "Lost" && items.some(i => i.status === "Found" && i.category === item.category && (i.postedBy?._id || i.postedBy) !== myId);
  const canMarkReturned = isOwner && item.status === "Found";
  const myClaim = item.claims?.find(c => (c.claimedBy?._id || c.claimedBy)?.toString() === myId);
  const isAdmin = currentUser.role === "admin";
  const pendingClaims = (isOwner || isAdmin) ? (item.claims || []).filter(c => c.claimStatus === "Pending") : [];

  document.getElementById("modalContent").innerHTML = `
    <div class="modal-item-img">
      ${item.img ? `<img src="${item.img}" alt="${item.name}" />` : `<i class="fa-solid ${categoryIcons[item.category] || "fa-box"}"></i>`}
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
      <h2 class="modal-title" style="margin:0">${item.name}</h2>
      <span class="status-tag ${item.status}">${item.status}</span>
      <span class="verified-badge"><i class="fa-solid fa-circle-check"></i> Verified</span>
    </div>
    <div class="modal-meta">
      <span><i class="fa-solid fa-location-dot"></i>${item.location}</span>
      <span><i class="fa-solid fa-calendar"></i>${item.date}</span>
      <span><i class="fa-solid fa-tag"></i>${item.category}</span>
      <span><i class="fa-solid fa-user"></i>Posted by ${item.postedByName || "Unknown"}</span>
      ${item.email ? `<span><i class="fa-solid fa-envelope"></i>${item.email}</span>` : ""}
    </div>
    ${item.desc ? `<div class="modal-desc">${item.desc}</div>` : ""}

    ${pendingClaims.length ? `
    <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">
      <div style="font-weight:600;margin-bottom:10px;font-size:0.9rem"><i class="fa-solid fa-hand-holding"></i> Pending Claims (${pendingClaims.length})</div>
      ${pendingClaims.map(c => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-weight:500;font-size:0.88rem">${c.claimedByName}</div>
            ${c.message ? `<div style="font-size:0.78rem;color:var(--text-muted)">${c.message}</div>` : ""}
            <div style="font-size:0.75rem;color:var(--text-muted)">${new Date(c.claimDate).toLocaleDateString()}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn-primary btn-sm" onclick="updateClaim('${item._id}','${c._id}','Approved')">Approve</button>
            <button class="btn-outline btn-sm" onclick="updateClaim('${item._id}','${c._id}','Rejected')">Reject</button>
          </div>
        </div>`).join("")}
    </div>` : ""}

    <div class="modal-actions">
      ${!isOwner && isVerified && !myClaim && item.status !== "Returned" ? `
        <button class="btn-primary" onclick="claimItem('${item._id}')"><i class="fa-solid fa-hand-holding"></i> Claim Item</button>` : ""}
      ${!isOwner && isVerified ? `<button class="btn-outline" onclick="startChat('${item._id}')"><i class="fa-solid fa-comments"></i> Contact Reporter</button>` : ""}
      ${!isOwner && !isVerified ? `
        <span style="font-size:0.82rem;color:#ef4444"><i class="fa-solid fa-lock"></i> Verified users only can claim or contact reporter</span>` : ""}
      ${!isOwner && isVerified && myClaim && myClaim.claimStatus === "Pending" ? `<span style="font-size:0.82rem;color:#f59e0b"><i class="fa-solid fa-clock"></i> Your claim is awaiting approval</span>` : ""}
      ${!isOwner && isVerified && myClaim && myClaim.claimStatus === "Rejected" ? `<span style="font-size:0.82rem;color:#ef4444"><i class="fa-solid fa-xmark"></i> Your claim was rejected</span>` : ""}
      ${canMarkReceived ? `<button class="btn-outline" onclick="updateItemStatus('${item._id}','Returned','received')"><i class="fa-solid fa-circle-check"></i> Mark Received</button>` : ""}
      ${canMarkReturned ? `<button class="btn-outline" onclick="updateItemStatus('${item._id}','Returned','returned')"><i class="fa-solid fa-handshake"></i> Mark Returned</button>` : ""}
    </div>`;
  document.getElementById("itemModal").classList.remove("hidden");
}

function closeModal() { document.getElementById("itemModal").classList.add("hidden"); }

async function claimItem(itemId) {
  const message = prompt("Add a message to your claim (optional):") || "";
  try {
    await api("POST", `/items/${itemId}/claims`, { message });
    showToast("Claim submitted successfully", "success");
    closeModal();
    renderClaims();
  } catch (err) { showToast(err.message, "error"); }
}

async function updateClaim(itemId, claimId, claimStatus) {
  const btn = event.target.closest("button");
  btnLoading(btn, true);
  try {
    const updated = await api("PATCH", `/items/${itemId}/claims/${claimId}`, { claimStatus });
    const idx = items.findIndex(i => i._id === itemId);
    if (idx >= 0) items[idx] = { ...items[idx], claims: updated.claims };
    showToast(`Claim ${claimStatus}`, "success");
    closeModal();
    renderClaims();
  } catch (err) { showToast(err.message, "error"); btnLoading(btn, false); }
}

function renderClaims() {
  const el = document.getElementById("claimsList");
  if (!el) return;
  // Fetch claims from API since items array doesn't include claims field
  api("GET", "/items/my-claims").then(allClaims => {
    if (!allClaims.length) {
      el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-hand-holding"></i><p>No claims yet</p></div>`;
      return;
    }
    el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:0.85rem">
      <thead><tr style="border-bottom:2px solid var(--border);text-align:left">
        <th style="padding:10px 12px">Item</th>
        <th style="padding:10px 12px">Claimed By</th>
        <th style="padding:10px 12px">Date</th>
        <th style="padding:10px 12px">Message</th>
        <th style="padding:10px 12px">Status</th>
      </tr></thead>
      <tbody>
        ${allClaims.map(c => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:10px 12px;font-weight:500">${c.itemName}</td>
            <td style="padding:10px 12px">${c.claimedByName || "—"}</td>
            <td style="padding:10px 12px">${c.claimDate ? new Date(c.claimDate).toLocaleDateString() : "—"}</td>
            <td style="padding:10px 12px;color:var(--text-muted)">${c.message || "—"}</td>
            <td style="padding:10px 12px">
              <span class="status-tag ${c.claimStatus === "Approved" ? "Found" : c.claimStatus === "Rejected" ? "Lost" : ""}"
                style="${c.claimStatus === "Pending" ? "background:#f59e0b22;color:#f59e0b" : ""}">
                ${c.claimStatus}
              </span>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;
  }).catch(() => {});
}

async function updateItemStatus(id, status, label) {
  try {
    const updated = await api("PATCH", `/items/${id}/status`, { status });
    const idx = items.findIndex(i => i._id === id);
    if (idx >= 0) items[idx] = updated;
    closeModal();
    renderAll();
    showToast(`Item marked as ${label}`, "success");
  } catch (err) { showToast(err.message, "error"); }
}

// ===== NOTIFICATIONS =====
function renderNotifications() {
  const el = document.getElementById("notifList");
  if (!notifications.length) { el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-bell-slash"></i><p>No notifications</p></div>`; return; }
  const icons = { match: "fa-link", verify: "fa-circle-check", chat: "fa-comments" };
  el.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.read ? "read" : "unread"}" onclick="handleNotifTap('${n._id}','${n.type}','${n.itemId || ""}')">
      <div class="notif-icon ${n.type}"><i class="fa-solid ${icons[n.type]}"></i></div>
      <div class="notif-body">
        <div class="notif-title">${n.title}</div>
        <div class="notif-desc">${n.desc}</div>
        <div class="notif-time">${new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
      </div>
      ${!n.read ? `<div style="width:8px;height:8px;background:var(--accent);border-radius:50%;flex-shrink:0"></div>` : ""}
    </div>`).join("");
}

async function handleNotifTap(id, type, itemId) {
  try {
    await api("PATCH", `/notifications/${id}/read`);
    const n = notifications.find(n => n._id === id);
    if (n) n.read = true;
    renderNotifications();
    updateBadges();
    if (type === "match" && itemId) { navigate("listings"); setTimeout(() => openModal(itemId), 100); }
    else if (type === "match") navigate("dashboard");
    else if (type === "chat") navigate("chat");
    else if (type === "verify") navigate("listings");
  } catch (e) { /* silent */ }
}

async function clearNotifications() {
  try {
    await api("PATCH", "/notifications/read-all");
    notifications.forEach(n => n.read = true);
    renderNotifications();
    updateBadges();
    showToast("All marked as read", "info");
  } catch (err) { showToast(err.message, "error"); }
}

function updateBadges() {
  const unread = notifications.filter(n => !n.read).length;
  const badge = document.getElementById("notifBadge");
  badge.textContent = unread;
  badge.style.display = unread > 0 ? "inline-block" : "none";
  document.getElementById("notifDot").classList.toggle("hidden", unread === 0);
  const chatUnread = conversations.reduce((sum, c) => sum + (c.unread || 0), 0);
  const chatBadge = document.getElementById("chatBadge");
  chatBadge.textContent = chatUnread;
  chatBadge.style.display = chatUnread > 0 ? "inline-block" : "none";
}

// ===== CHAT =====
function renderConversations() {
  const el = document.getElementById("conversationList");
  if (!conversations.length) {
    el.innerHTML = `<div class="empty-state" style="padding:24px"><i class="fa-solid fa-comments"></i><p>No conversations yet</p></div>`;
    return;
  }
  el.innerHTML = conversations.map(c => {
    // Get the other participant's name
    const other = c.participants?.find(p => (p._id || p) !== currentUser._id);
    const name = other ? `${other.first} ${other.last}` : c.item;
    const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    return `
    <div class="convo-item ${activeConvo === c._id ? "active" : ""}" onclick="openConversation('${c._id}')">
      <div class="convo-avatar">${initials}</div>
      <div class="convo-info">
        <div class="convo-name">${name}</div>
        <div class="convo-preview">${c.lastMsg || "No messages yet"}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <span class="convo-time">${c.updatedAt ? new Date(c.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
      </div>
    </div>`;
  }).join("");
}

function openConversation(id) {
  activeConvo = id;
  const convo = conversations.find(c => c._id === id);
  if (!convo) return;
  renderConversations();
  const other = convo.participants?.find(p => (p._id || p) !== currentUser._id);
  const name = other ? `${other.first} ${other.last}` : convo.item;
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const win = document.getElementById("chatWindow");
  win.innerHTML = `
    <div class="chat-header">
      <div class="convo-avatar">${initials}</div>
      <div class="chat-header-info">
        <div class="chat-header-name">${name}</div>
        <div class="chat-header-item">Re: ${convo.item}</div>
      </div>
      <span class="verified-badge"><i class="fa-solid fa-lock"></i> Secure Chat</span>
    </div>
    <div class="chat-messages" id="chatMessages">
      ${(convo.messages || []).map(m => `
        <div class="msg ${m.from === currentUser._id || m.from === "me" ? "sent" : "received"}">
          <div class="msg-bubble">${m.text}</div>
          <div class="msg-time">${m.time || ""}</div>
        </div>`).join("")}
    </div>
    <div class="chat-input-area">
      <input type="text" id="msgInput" placeholder="Type a message..." onkeydown="if(event.key==='Enter') sendMessage('${id}')" />
      <button class="send-btn" onclick="sendMessage('${id}')"><i class="fa-solid fa-paper-plane"></i></button>
    </div>`;
  scrollChat();
}

async function sendMessage(convoId) {
  const input = document.getElementById("msgInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  // Optimistic UI
  const msgs = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = "msg sent";
  div.innerHTML = `<div class="msg-bubble">${text}</div><div class="msg-time">${time}</div>`;
  msgs.appendChild(div);
  scrollChat();
  try {
    const updated = await api("POST", `/conversations/${convoId}/messages`, { text });
    const idx = conversations.findIndex(c => c._id === convoId);
    if (idx >= 0) conversations[idx] = { ...updated, participants: conversations[idx].participants };
    renderConversations();
  } catch (err) { showToast(err.message, "error"); }
}

function scrollChat() { const msgs = document.getElementById("chatMessages"); if (msgs) msgs.scrollTop = msgs.scrollHeight; }

async function startChat(itemId) {
  try {
    const convo = await api("POST", "/conversations", { itemId });
    const exists = conversations.find(c => c._id === convo._id);
    if (!exists) conversations.unshift(convo);
    else conversations[conversations.indexOf(exists)] = convo;
    closeModal();
    navigate("chat");
    renderConversations();
    openConversation(convo._id);
  } catch (err) { showToast(err.message, "error"); }
}

// ===== UTILS =====
function setDefaultDate() {
  const dateInput = document.getElementById("fDate");
  if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
}

function showToast(msg, type = "info") {
  const toast = document.getElementById("toast");
  const icons = { success: "fa-circle-check", error: "fa-circle-xmark", info: "fa-circle-info" };
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i> ${msg}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add("hidden"), 3500);
}

function btnLoading(btn, loading, originalHTML) {
  if (loading) {
    btn.disabled = true;
    btn._original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  } else {
    btn.disabled = false;
    btn.innerHTML = originalHTML || btn._original || btn.innerHTML;
  }
}

// ===== ADMIN =====
let adminUsers = [];
let adminItems = [];

async function loadAdminPanel() {
  try {
    const [users, items, stats] = await Promise.all([
      api("GET", "/admin/users"),
      api("GET", "/admin/items"),
      api("GET", "/admin/stats"),
    ]);
    adminUsers = users;
    adminItems = items;
    renderAdminStats(stats);
    filterAdminUsers();
    filterAdminItems();
    setupBroadcastForm();
    renderAdminClaims();
    // Load subscriptions
    api("GET", "/admin/subscriptions").then(renderAdminSubscriptions).catch(() => {});
  } catch (err) { showToast(err.message, "error"); }
}

function renderAdminStats(stats) {
  document.getElementById("aStatUsers").textContent = stats.totalUsers;
  document.getElementById("aStatVerifiedUsers").textContent = stats.verifiedUsers;
  document.getElementById("aStatPendingUsers").textContent = stats.unverifiedUsers;
  document.getElementById("aStatItems").textContent = stats.totalItems;
  document.getElementById("aStatPendingItems").textContent = stats.pendingItems;
}

function updateAdminStats() {
  const nonAdmins = adminUsers.filter(u => u.role !== "admin");
  document.getElementById("aStatUsers").textContent = nonAdmins.length;
  document.getElementById("aStatVerifiedUsers").textContent = nonAdmins.filter(u => u.verified).length;
  document.getElementById("aStatPendingUsers").textContent = nonAdmins.filter(u => !u.verified).length;
  document.getElementById("aStatItems").textContent = adminItems.length;
  document.getElementById("aStatVerifiedItems").textContent = adminItems.filter(i => i.verified).length;
  document.getElementById("aStatPendingItems").textContent = adminItems.filter(i => !i.verified).length;
}

function filterAdminUsers() {
  const filter = document.getElementById("adminUserFilter")?.value || "all";
  const search = document.getElementById("adminUserSearch")?.value.toLowerCase() || "";
  const filtered = adminUsers.filter(u => {
    const matchFilter = filter === "all" || (filter === "pending" && !u.verified) || (filter === "verified" && u.verified);
    const matchSearch = !search || `${u.first} ${u.last} ${u.email}`.toLowerCase().includes(search);
    return matchFilter && matchSearch;
  });
  renderAdminUsers(filtered);
}

function filterAdminItems() {
  const filter = document.getElementById("adminItemFilter")?.value || "all";
  const search = document.getElementById("adminItemSearch")?.value.toLowerCase() || "";
  const filtered = adminItems.filter(i => {
    const matchFilter = filter === "all" || (filter === "pending" && !i.verified) || (filter === "verified" && i.verified);
    const matchSearch = !search || `${i.name} ${i.postedByName} ${i.location}`.toLowerCase().includes(search);
    return matchFilter && matchSearch;
  });
  renderAdminItems(filtered);
}

function setupBroadcastForm() {
  const form = document.getElementById("broadcastForm");
  if (!form || form._bound) return;
  form._bound = true;
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const title = document.getElementById("bTitle").value.trim();
    const desc = document.getElementById("bDesc").value.trim();
    if (!title || !desc) { showToast("Title and message required", "error"); return; }
    try {
      const res = await api("POST", "/admin/broadcast", { title, desc });
      showToast(`Sent to ${res.sent} users`, "success");
      form.reset();
    } catch (err) { showToast(err.message, "error"); }
  });
}

function renderAdminUsers(list) {
  const el = document.getElementById("adminUserList");
  if (!list || !list.length) { el.innerHTML = `<div class="empty-state"><p>No users found</p></div>`; return; }
  el.innerHTML = list.map(u => `
    <div class="activity-item" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div>
        <strong>${u.first} ${u.last}</strong>
        <div style="font-size:0.78rem;color:var(--text-muted)">${u.email}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span class="status-tag ${u.verified ? 'Found' : 'Lost'}" style="font-size:0.72rem">${u.verified ? 'Verified' : 'Pending'}</span>
        <span class="status-tag ${u.role === 'admin' ? 'Returned' : ''}" style="font-size:0.72rem">${u.role}</span>
        ${u._id !== currentUser._id ? `
          ${!u.verified
            ? `<button class="btn-outline btn-sm" style="color:var(--success)" onclick="approveUser('${u._id}',true)">Approve</button>`
            : `<button class="btn-outline btn-sm" style="color:var(--warning)" onclick="approveUser('${u._id}',false)">Revoke</button>`}
          <button class="btn-outline btn-sm" onclick="toggleUserRole('${u._id}','${u.role}')">
            ${u.role === 'admin' ? 'Demote' : 'Promote'}
          </button>
          <button class="btn-outline btn-sm" style="color:var(--danger)" onclick="adminDeleteUser('${u._id}','${u.first} ${u.last}')">
            <i class="fa-solid fa-trash"></i>
          </button>` : `<span style="font-size:0.75rem;color:var(--text-muted)">(you)</span>`}
      </div>
    </div>`).join("");
}

function renderAdminItems(list) {
  const el = document.getElementById("adminItemList");
  if (!list || !list.length) { el.innerHTML = `<div class="empty-state"><p>No items found</p></div>`; return; }
  el.innerHTML = list.map(item => `
    <div class="activity-item" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div>
        <strong>${item.name}</strong>
        <div style="font-size:0.78rem;color:var(--text-muted)">${item.postedByName} · ${item.location}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span class="status-tag ${item.status}">${item.status}</span>
        <span class="status-tag ${item.verified ? 'Found' : 'Lost'}" style="font-size:0.72rem">${item.verified ? 'Verified' : 'Pending'}</span>
        ${!item.verified
          ? `<button class="btn-outline btn-sm" style="color:var(--success)" onclick="approveItem('${item._id}',true)">Approve</button>`
          : `<button class="btn-outline btn-sm" style="color:var(--warning)" onclick="approveItem('${item._id}',false)">Revoke</button>`}
        <button class="btn-outline btn-sm" style="color:var(--danger)" onclick="adminDeleteItem('${item._id}','${item.name}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>`).join("");
}

async function adminDeleteItem(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  const btn = event.target.closest("button");
  btnLoading(btn, true);
  try {
    await api("DELETE", `/admin/items/${id}`);
    adminItems = adminItems.filter(i => i._id !== id);
    items = items.filter(i => i._id !== id);
    filterAdminItems();
    updateAdminStats();
    renderAll();
    showToast(`"${name}" deleted`, "info");
  } catch (err) { showToast(err.message, "error"); btnLoading(btn, false); }
}

async function adminDeleteUser(id, name) {
  if (!confirm(`Delete user "${name}" and all their items? This cannot be undone.`)) return;
  const btn = event.target.closest("button");
  btnLoading(btn, true);
  try {
    await api("DELETE", `/admin/users/${id}`);
    adminUsers = adminUsers.filter(u => u._id !== id);
    adminItems = adminItems.filter(i => (i.postedBy?._id || i.postedBy) !== id);
    items = items.filter(i => (i.postedBy?._id || i.postedBy) !== id);
    filterAdminUsers();
    filterAdminItems();
    updateAdminStats();
    renderAll();
    showToast(`User "${name}" deleted`, "info");
  } catch (err) { showToast(err.message, "error"); btnLoading(btn, false); }
}

async function approveUser(id, verified) {
  const btn = event.target.closest("button");
  btnLoading(btn, true);
  try {
    const updated = await api("PATCH", `/admin/users/${id}/verify`, { verified });
    const idx = adminUsers.findIndex(u => u._id === id);
    if (idx >= 0) adminUsers[idx] = updated;
    filterAdminUsers();
    updateAdminStats();
    showToast(`User ${verified ? "approved" : "revoked"}`, verified ? "success" : "info");
  } catch (err) { showToast(err.message, "error"); btnLoading(btn, false); }
}

async function approveItem(id, verified) {
  const btn = event.target.closest("button");
  btnLoading(btn, true);
  try {
    const updated = await api("PATCH", `/admin/items/${id}/verify`, { verified });
    const idx = adminItems.findIndex(i => i._id === id);
    if (idx >= 0) adminItems[idx] = { ...adminItems[idx], verified: updated.verified };
    if (verified) { items = items.filter(i => i._id !== id); items.unshift(updated); }
    else items = items.filter(i => i._id !== id);
    filterAdminItems();
    updateAdminStats();
    renderAll();
    showToast(`Item ${verified ? "approved" : "revoked"}`, verified ? "success" : "info");
  } catch (err) { showToast(err.message, "error"); btnLoading(btn, false); }
}

async function toggleUserRole(id, currentRole) {
  const btn = event.target.closest("button");
  btnLoading(btn, true);
  const newRole = currentRole === "admin" ? "user" : "admin";
  try {
    const updated = await api("PATCH", `/admin/users/${id}/role`, { role: newRole });
    const idx = adminUsers.findIndex(u => u._id === id);
    if (idx >= 0) adminUsers[idx] = updated;
    filterAdminUsers();
    updateAdminStats();
    showToast(`User role updated to ${newRole}`, "success");
  } catch (err) { showToast(err.message, "error"); btnLoading(btn, false); }
}

function renderAdminClaims() {
  const el = document.getElementById("adminClaimList");
  if (!el) return;
  const filter = document.getElementById("adminClaimFilter")?.value || "all";
  const allClaims = [];
  adminItems.forEach(item => {
    (item.claims || []).forEach(c => {
      allClaims.push({ ...c, itemName: item.name, itemId: item._id });
    });
  });
  const filtered = filter === "all" ? allClaims : allClaims.filter(c => c.claimStatus === filter);
  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-hand-holding"></i><p>No claims found</p></div>`;
    return;
  }
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:0.85rem">
    <thead><tr style="border-bottom:2px solid var(--border);text-align:left">
      <th style="padding:10px 12px">Item</th>
      <th style="padding:10px 12px">Claimed By</th>
      <th style="padding:10px 12px">Claim Date</th>
      <th style="padding:10px 12px">Message</th>
      <th style="padding:10px 12px">Status</th>
      <th style="padding:10px 12px">Action</th>
    </tr></thead>
    <tbody>
      ${filtered.map(c => `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:10px 12px;font-weight:500">${c.itemName}</td>
          <td style="padding:10px 12px">${c.claimedByName || "—"}</td>
          <td style="padding:10px 12px">${new Date(c.claimDate).toLocaleDateString()}</td>
          <td style="padding:10px 12px;color:var(--text-muted)">${c.message || "—"}</td>
          <td style="padding:10px 12px">
            <span class="status-tag ${c.claimStatus === "Approved" ? "Found" : c.claimStatus === "Rejected" ? "Lost" : ""}"
              style="${c.claimStatus === "Pending" ? "background:#f59e0b22;color:#f59e0b" : ""}">
              ${c.claimStatus}
            </span>
          </td>
          <td style="padding:10px 12px">
            ${c.claimStatus === "Pending" ? `
              <button class="btn-outline btn-sm" style="color:var(--success)" onclick="adminUpdateClaim('${c.itemId}','${c._id}','Approved')">Approve</button>
              <button class="btn-outline btn-sm" style="color:var(--danger)" onclick="adminUpdateClaim('${c.itemId}','${c._id}','Rejected')">Reject</button>
            ` : "—"}
          </td>
        </tr>`).join("")}
    </tbody>
  </table>`;
}

async function adminUpdateClaim(itemId, claimId, claimStatus) {
  const btn = event.target.closest("button");
  btnLoading(btn, true);
  try {
    const updated = await api("PATCH", `/items/${itemId}/claims/${claimId}`, { claimStatus });
    const idx = adminItems.findIndex(i => i._id === itemId);
    if (idx >= 0) adminItems[idx] = { ...adminItems[idx], claims: updated.claims };
    renderAdminClaims();
    renderClaims();
    renderStats();
    showToast(`Claim ${claimStatus}`, "success");
  } catch (err) { showToast(err.message, "error"); btnLoading(btn, false); }
}

// ===== SUBSCRIPTION =====
let selectedPlan = null;
let selectedMethod = "visa";

async function loadSubscription() {
  try {
    const sub = await api("GET", "/subscription/status");
    renderSubStatus(sub);
  } catch (err) { showToast(err.message, "error"); }
}

function renderSubStatus(sub) {
  const el = document.getElementById("subStatusDisplay");
  if (sub.status === "active") {
    const end = new Date(sub.endDate).toLocaleDateString();
    el.innerHTML = `
      <i class="fa-solid fa-crown" style="font-size:2rem;color:#eab308;margin-bottom:8px"></i>
      <div class="sub-status-active">Active Subscription</div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-top:4px">
        Plan: <strong>${sub.plan}</strong> · Expires: <strong>${end}</strong> · Method: <strong>${sub.method}</strong>
      </div>`;
    document.getElementById("subPlansSection").classList.add("hidden");
  } else {
    el.innerHTML = `
      <i class="fa-solid fa-circle-xmark" style="font-size:2rem;color:var(--danger);margin-bottom:8px"></i>
      <div class="sub-status-inactive">${sub.status === "expired" ? "Subscription Expired" : "No Active Subscription"}</div>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-top:4px">Subscribe to get your items approved and listed on the dashboard.</div>`;
    document.getElementById("subPlansSection").classList.remove("hidden");
  }
}

function selectPlan(plan) {
  selectedPlan = plan;
  document.querySelectorAll(".sub-plan").forEach(el => el.classList.remove("selected"));
  document.getElementById("plan" + plan.charAt(0).toUpperCase() + plan.slice(1)).classList.add("selected");
  document.getElementById("paymentForm").classList.remove("hidden");
  document.getElementById("paymentForm").scrollIntoView({ behavior: "smooth" });
}

function selectMethod(method) {
  selectedMethod = method;
  document.querySelectorAll(".pay-method-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`[data-method="${method}"]`).classList.add("active");
  const isCard = ["visa", "mastercard"].includes(method);
  document.getElementById("cardFields").classList.toggle("hidden", !isCard);
  document.getElementById("momoFields").classList.toggle("hidden", isCard);
}

function formatCard(input) {
  let val = input.value.replace(/\D/g, "").substring(0, 16);
  input.value = val.replace(/(.{4})/g, "$1 ").trim();
}

function cancelPayment() {
  document.getElementById("paymentForm").classList.add("hidden");
  selectedPlan = null;
  document.querySelectorAll(".sub-plan").forEach(el => el.classList.remove("selected"));
}

async function processPayment() {
  if (!selectedPlan) { showToast("Please select a plan", "error"); return; }
  const btn = document.getElementById("payBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

  const body = { plan: selectedPlan, method: selectedMethod };
  if (["visa", "mastercard"].includes(selectedMethod)) {
    body.cardNumber = document.getElementById("cardNumber").value;
    body.cardName = document.getElementById("cardName").value;
    body.expiry = document.getElementById("cardExpiry").value;
    body.cvv = document.getElementById("cardCvv").value;
  } else {
    body.phone = document.getElementById("momoPhone").value;
  }

  try {
    const res = await api("POST", "/subscription/subscribe", body);
    currentUser = res.user;
    showToast("Subscription activated successfully!", "success");
    await loadSubscription();
    // Reset form
    document.getElementById("paymentForm").classList.add("hidden");
    selectedPlan = null;
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-lock"></i> Pay Now';
  }
}

function renderAdminSubscriptions(subs) {
  const el = document.getElementById("adminSubList");
  if (!el) return;
  if (!subs.length) { el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-crown"></i><p>No active subscriptions</p></div>`; return; }
  el.innerHTML = `<table style="width:100%;border-collapse:collapse">
    <thead><tr style="border-bottom:2px solid var(--border);font-size:0.8rem;color:var(--text-muted)">
      <th style="padding:10px 12px;text-align:left">User</th>
      <th style="padding:10px 12px;text-align:left">Plan</th>
      <th style="padding:10px 12px;text-align:left">Method</th>
      <th style="padding:10px 12px;text-align:left">Start</th>
      <th style="padding:10px 12px;text-align:left">Expires</th>
      <th style="padding:10px 12px;text-align:left">Status</th>
    </tr></thead>
    <tbody>
      ${subs.map(u => `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:10px 12px">
            <div style="font-weight:500">${u.first} ${u.last}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">${u.email}</div>
          </td>
          <td style="padding:10px 12px;text-transform:capitalize">${u.subscription.plan}</td>
          <td style="padding:10px 12px;text-transform:uppercase">${u.subscription.method}</td>
          <td style="padding:10px 12px;font-size:0.82rem">${new Date(u.subscription.startDate).toLocaleDateString()}</td>
          <td style="padding:10px 12px;font-size:0.82rem">${new Date(u.subscription.endDate).toLocaleDateString()}</td>
          <td style="padding:10px 12px"><span class="status-tag Found">Active</span></td>
        </tr>`).join("")}
    </tbody>
  </table>`;
}
