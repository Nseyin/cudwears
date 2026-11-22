/**
 * ==============================================
 * --- MASTER SCRIPT FOR CUDWEARS ---
 * ==============================================
 */

// =============================================
// GLOBAL STATE
// =============================================
let originalSectionsInOrder = [];
let activeTabIdBeforeSearch = null;

const ALL_TAB_IDS = [
    'tab1','tab3','tab13','tab14','tab15','tab2','tab4','tab5','tab6','tab7','tab8','tab9','tab10','tab11','tab12','connect-content'
];
let currentTabIndex = 0;

const TAB_NAMES = {
    "tab1": "Home",
    "tab2": "Categories",
    "tab3": "Market",
    "tab4": "New In & Saved",
    "tab5": "Designers",
    "tab6": "Track Order",
    "tab7": "Size Guide",
    "tab8": "How It Works",
    "tab9": "Delivery & Payment",
    "tab10": "Custom & Help",
    "tab11": "Sell With Us",
    "tab12": "About & Reviews",
    "tab13": "Services",
    "tab14": "Rentals",
    "tab15": "List",
    "connect-content": "Contact"
};

let breadcrumbHistory = [];

// =============================================
// 1. CORE TAB SWITCHING
// =============================================
function openTab(event, tabId) {
    const appContainer = document.querySelector('.app-container');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    if (event && searchInput && searchInput.value) {
        searchInput.value = '';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
        filterContent('');
    }

    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    document.querySelectorAll('.tab-button, .nav-item').forEach(el => el.classList.remove('active'));

    const isSidebarTab = tabId.startsWith('tab') && !tabId.includes('-content');

    if (isSidebarTab) {
        appContainer.classList.remove('sidebar-hidden');
    } else {
        appContainer.classList.add('sidebar-hidden');
    }

    const targetContent = document.getElementById(tabId);
    if (targetContent) {
        targetContent.classList.add('active');
        targetContent.style.display = 'block';
        if (targetContent.classList.contains('view')) {
            animateView(targetContent);
        }
    }

    if (isSidebarTab) {
        const sidebarButton = document.querySelector(`.tab-button[onclick*="'${tabId}'"]`);
        if (sidebarButton) sidebarButton.classList.add('active');
        if (tabId === 'tab1') {
            const homeFooterButton = document.querySelector('.nav-item[onclick*="tab1"]');
            if (homeFooterButton) homeFooterButton.classList.add('active');
        }
    } else {
        const footerButton = document.querySelector(`.nav-item[onclick*="'${tabId}'"]`);
        if (footerButton) footerButton.classList.add('active');
    }

    const activeNavItem = document.querySelector('.nav-item.active');
    if (activeNavItem) {
        const activeIndex = activeNavItem.dataset.index;
        const footerNav = document.querySelector('.footer-nav');
        if (footerNav) footerNav.style.setProperty('--active-index', activeIndex);
    }

    const idx = ALL_TAB_IDS.indexOf(tabId);
    if (idx !== -1) currentTabIndex = idx;

    try { localStorage.setItem('cudfirm_last_tab', tabId); } catch(e) {}

    updateBreadcrumb(tabId);

    const contentMain = document.querySelector('.content-main');
    if (contentMain) contentMain.scrollTop = 0;
}

// =============================================
// 2. GSAP ANIMATION
// =============================================
function animateView(viewElement) {
    if (typeof gsap === 'undefined') return;
    gsap.fromTo(viewElement,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', clearProps: 'opacity,transform' }
    );
    const items = viewElement.querySelectorAll('.card, .list-item');
    if (items.length) {
        gsap.from(items, { opacity: 0, duration: 0.35, stagger: { amount: 0.3 }, ease: 'power2.out', delay: 0.05, clearProps: 'opacity,transform' });
    }
}

// =============================================
// 3. VIEW-SPECIFIC SEARCH
// =============================================
function handleViewSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const targetListSelector = e.target.dataset.targetList;
    if (!targetListSelector) return;
    const listContainer = document.querySelector(targetListSelector);
    if (!listContainer) return;
    listContainer.querySelectorAll('.card, .list-item').forEach(item => {
        const text = item.dataset.searchText || item.textContent;
        item.style.display = text.toLowerCase().includes(searchTerm) ? '' : 'none';
    });
}

// =============================================
// 4. MODAL
// =============================================
function openModal(title, content) {
    const modal = document.getElementById('modal');
    if (!modal) return;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    modal.classList.add('visible');
    if (typeof gsap !== 'undefined') gsap.from('.modal-content', { scale: 0.9, opacity: 0, duration: 0.3, ease: 'power2.out' });
}

function closeModal() {
    const modal = document.getElementById('modal');
    if (!modal) return;
    if (typeof gsap !== 'undefined') {
        gsap.to('.modal-content', { scale: 0.9, opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: () => modal.classList.remove('visible') });
    } else {
        modal.classList.remove('visible');
    }
}

// =================================
// SEND TO ADMIN (Google Sheets + redirect)
// =================================
function sendToAdmin() {
    const name = document.getElementById('contactName').value.trim();
    const contactInfo = document.getElementById('contactInfo').value.trim();
    const message = document.getElementById('contactMessage').value.trim();

    if (!name || !contactInfo || !message) {
        openModal('Input Required', '<p>Please fill in all fields before submitting.</p>');
        return;
    }

    submitToGoogleSheets(name, contactInfo, message);

    setTimeout(function () {
        window.location.href = 'success.html';
    }, 1000);
}

// =============================================
// SEND TO WHATSAPP (with form content pre-filled)
// =============================================
function sendToWhatsAppWithForm() {
    const yourNumber = '2348028699824';
    const name = document.getElementById('contactName').value.trim();
    const contactInfo = document.getElementById('contactInfo').value.trim();
    const message = document.getElementById('contactMessage').value.trim();

    if (!name || !contactInfo || !message) {
        openModal('Input Required', '<p>Please fill in all fields before sending.</p>');
        return;
    }

    const text = `Hello CUDWEARS,\nMy Name: ${name}\nMy Contact: ${contactInfo}\n\nMy Request:\n${message}`;
    window.open(`https://wa.me/${yourNumber}?text=${encodeURIComponent(text)}`, '_blank');
}

// =============================================
// SEND TO EMAIL (opens email client with body)
// =============================================
function sendToEmail() {
    const name = document.getElementById('contactName').value.trim();
    const contactInfo = document.getElementById('contactInfo').value.trim();
    const message = document.getElementById('contactMessage').value.trim();

    if (!name || !contactInfo || !message) {
        openModal('Input Required', '<p>Please fill in all fields before sending.</p>');
        return;
    }

    const subject = encodeURIComponent('New Message - CUDWEARS');
    const body = encodeURIComponent(
        `Name: ${name}\nContact Info: ${contactInfo}\n\nMessage:\n${message}`
    );
    window.location.href = `mailto:cudfirm@gmail.com?subject=${subject}&body=${body}`;
}

// =============================================
// GOOGLE SHEETS SUBMISSION
// =============================================
function submitToGoogleSheets(name, contactInfo, message) {
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxQGJLYV8bR1HeXJJfBPx1boRR-jcW4prS2hojJfxasiDtl6eqfUxYnJEsL1tO52CbM/exec';

    const formData = new FormData();
    formData.append('name', name);
    formData.append('contact_info', contactInfo);
    formData.append('message', message);
    formData.append('timestamp', new Date().toISOString());

    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: formData
    }).catch(function (err) {
        console.warn('Google Sheets submission failed:', err);
    });
}

// ==============================
// 6. GLOBAL SEARCH
// ===============================
function unhighlight(container) {
    container.querySelectorAll('mark.highlight').forEach(mark => {
        mark.parentNode.replaceChild(document.createTextNode(mark.textContent), mark);
    });
    container.normalize();
}

function highlightText(node, term) {
    if (!term.trim()) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
    let textNode;
    const replacements = [];
    const lower = term.toLowerCase();
    while (textNode = walker.nextNode()) {
        const tag = textNode.parentElement.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE') continue;
        const lowerVal = textNode.nodeValue.toLowerCase();
        if (!lowerVal.includes(lower)) continue;
        const frag = document.createDocumentFragment();
        let last = 0, start = 0;
        while ((start = lowerVal.indexOf(lower, last)) > -1) {
            frag.appendChild(document.createTextNode(textNode.nodeValue.substring(last, start)));
            const mark = document.createElement('mark');
            mark.className = 'highlight';
            mark.textContent = textNode.nodeValue.substring(start, start + term.length);
            frag.appendChild(mark);
            last = start + term.length;
        }
        frag.appendChild(document.createTextNode(textNode.nodeValue.substring(last)));
        replacements.push({ original: textNode, replacement: frag });
    }
    replacements.forEach(r => { if (r.original.parentNode) r.original.parentNode.replaceChild(r.replacement, r.original); });
}

function filterContent(term) {
    const lowerTerm = term.toLowerCase();
    const contentMain = document.querySelector('.content-main');
    contentMain.style.opacity = '0';
    setTimeout(() => {
        unhighlight(contentMain);
        const existing = contentMain.querySelector('.no-results-message');
        if (existing) existing.remove();
        if (!lowerTerm) {
            originalSectionsInOrder.forEach(s => s.style.display = 'none');
            const restore = activeTabIdBeforeSearch || 'tab1';
            openTab(null, restore);
            activeTabIdBeforeSearch = null;
        } else {
            if (activeTabIdBeforeSearch === null) {
                const active = document.querySelector('.tab-content.active');
                activeTabIdBeforeSearch = active ? active.id : 'tab1';
            }
            document.querySelectorAll('.tab-content, .tab-button, .nav-item').forEach(el => {
                el.classList.remove('active');
                if (el.matches('.tab-content')) el.style.display = 'none';
            });
            let found = 0;
            originalSectionsInOrder.forEach(s => {
                if (s.textContent.toLowerCase().includes(lowerTerm)) {
                    highlightText(s, term);
                    s.style.display = 'block';
                    found++;
                } else {
                    s.style.display = 'none';
                }
            });
            if (found === 0) {
                const msg = document.createElement('div');
                msg.className = 'no-results-message';
                msg.innerHTML = `No results found for '<strong>${term.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</strong>'`;
                contentMain.appendChild(msg);
            }
        }
        contentMain.style.opacity = '1';
    }, 300);
}

// =============================================
// 7. COURSE ICONS
// =============================================
function populateCourseIcons() {
    // data-filter opens the Market filtered; data-svc-* opens Services / Rentals filtered (handled in js/hub.js)
    const shop = [
        { name: 'Clothing', icon: 'fa-shirt', filter: 'clothing', badge: 'HOT' },
        { name: 'Footwear', icon: 'fa-shoe-prints', filter: 'footwear', badge: '' },
        { name: 'Bags & Home', icon: 'fa-bag-shopping', filter: 'accessories', badge: 'NEW' },
        { name: 'Dresses', icon: 'fa-person-dress', filter: 'Dress', badge: '' },
        { name: 'Shirts', icon: 'fa-shirt', filter: 'Shirt', badge: '' },
        { name: 'Pants', icon: 'fa-user', filter: 'Pant', badge: '' },
        { name: 'Skirts', icon: 'fa-person-dress', filter: 'Skirt', badge: '' },
        { name: 'Shoes', icon: 'fa-shoe-prints', filter: 'Shoe', badge: '' },
        { name: 'Bags', icon: 'fa-bag-shopping', filter: 'Bag', badge: '' },
        { name: 'Pillows', icon: 'fa-couch', filter: 'Pillow', badge: '' },
        { name: 'Tablecloths', icon: 'fa-utensils', filter: 'Tablecloth', badge: '' }
    ];
    const svc = [
        { name: 'Tailors', icon: 'fa-scissors', g: 'fashion', k: 'service' },
        { name: 'Fittings', icon: 'fa-ruler', g: 'fitting', k: 'service' },
        { name: 'Alterations', icon: 'fa-screwdriver-wrench', g: 'alter', k: 'service' },
        { name: 'Embroidery', icon: 'fa-wand-magic-sparkles', g: 'craft', k: 'service' },
        { name: 'Laundry', icon: 'fa-droplet', g: 'care', k: 'service' },
        { name: 'Outfit Rentals', icon: 'fa-person-dress', g: 'wear', k: 'rental' },
        { name: 'Bridal Hire', icon: 'fa-ring', g: 'bridal', k: 'rental' },
        { name: 'Accessories Hire', icon: 'fa-gem', g: 'acc', k: 'rental' }
    ];
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const a = document.getElementById('classic-regular-icons-container');
    if (a) {
        a.innerHTML = shop.map(item => `<div class="col"><a href="#" class="icon-item-explore" data-filter="${esc(item.filter)}">
                <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
                <span class="flex-grow-1">${item.name}</span>
                ${item.badge ? '<div class="free-badge">' + item.badge + '</div>' : ''}
            </a></div>`).join('') + `<div class="col"><a href="#" class="view-more-btn" data-filter="">
                <span>All designs</span><i class="fa-solid fa-arrow-right ms-2" aria-hidden="true"></i>
            </a></div>`;
    }
    const b = document.getElementById('classic-light-icons-container');
    if (b) {
        b.innerHTML = svc.map(item => `<div class="col"><a href="#" class="icon-item-explore" data-svc-group="${item.g}" data-kind="${item.k}">
                <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
                <span class="flex-grow-1">${item.name}</span>
            </a></div>`).join('');
    }
}

// =============================================
// 8. DARK MODE
// =============================================
function initDarkMode() {
    const toggle = document.getElementById('darkModeToggle');
    const icon = document.getElementById('darkModeIcon');
    const html = document.documentElement;
    try {
        if (localStorage.getItem('cudfirm_theme') === 'dark') {
            html.setAttribute('data-theme', 'dark');
            if (icon) icon.className = 'bi bi-sun-fill';
        }
    } catch(e) {}
    if (!toggle) return;
    toggle.addEventListener('click', () => {
        const isDark = html.getAttribute('data-theme') === 'dark';
        html.setAttribute('data-theme', isDark ? 'light' : 'dark');
        if (icon) icon.className = isDark ? 'bi bi-moon-fill' : 'bi bi-sun-fill';
        try { localStorage.setItem('cudfirm_theme', isDark ? 'light' : 'dark'); } catch(e) {}
        showToast(isDark ? 'Light mode on ☀️' : 'Dark mode on 🌙');
    });
}

// =============================================
// 9. TOAST
// =============================================
let toastTimer = null;
function showToast(message, duration) {
    duration = duration || 2500;
    const toast = document.getElementById('toastNotification');
    const msg = document.getElementById('toastMessage');
    if (!toast || !msg) return;
    msg.textContent = message;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// =============================================
// 10. COPY TO CLIPBOARD
// =============================================
function copyToClipboard(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showToast(successMessage || 'Copied! ✓')).catch(() => showToast('Could not copy.'));
    } else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); showToast(successMessage || 'Copied! ✓'); } catch(e) { showToast('Could not copy.'); }
        document.body.removeChild(ta);
    }
}

// =============================================
// 11. READING PROGRESS BAR
// =============================================
function initReadingProgressBar() {
    const bar = document.getElementById('readingProgressBar');
    const contentMain = document.querySelector('.content-main');
    if (!bar || !contentMain) return;
    contentMain.addEventListener('scroll', () => {
        const h = contentMain.scrollHeight - contentMain.clientHeight;
        bar.style.width = (h > 0 ? (contentMain.scrollTop / h) * 100 : 0) + '%';
    }, { passive: true });
}

// =============================================
// 12. BACK TO TOP
// =============================================
function initBackToTop() {
    const btn = document.getElementById('backToTopBtn');
    const contentMain = document.querySelector('.content-main');
    if (!btn || !contentMain) return;
    contentMain.addEventListener('scroll', () => btn.classList.toggle('visible', contentMain.scrollTop > 200), { passive: true });
    btn.addEventListener('click', () => contentMain.scrollTo({ top: 0, behavior: 'smooth' }));
}

// =============================================
// 13. BREADCRUMB
// =============================================
function updateBreadcrumb(tabId) {
    const name = TAB_NAMES[tabId] || tabId;
    if (breadcrumbHistory[breadcrumbHistory.length - 1] === name) return;
    breadcrumbHistory.push(name);
    if (breadcrumbHistory.length > 3) breadcrumbHistory.shift();
    const trail = document.getElementById('breadcrumbTrail');
    if (!trail) return;
    trail.innerHTML = breadcrumbHistory.map((item, i) => {
        const isCurrent = i === breadcrumbHistory.length - 1;
        return `<span class="bc-item${isCurrent ? ' bc-current' : ''}">${item}</span>${isCurrent ? '' : '<span class="bc-sep">›</span>'}`;
    }).join('');
}

// =============================================
// 14. LIVE USER COUNT
// =============================================
function initLiveUserCount() {
    const blogCount = document.getElementById('liveUserCount');
    const sidebarCount = document.getElementById('sidebarLiveCount');
    function update() {
        const count = Math.max(5, 12 + Math.floor(new Date().getHours() * 0.6) + Math.floor(Math.random() * 7) - 3);
        if (blogCount) blogCount.textContent = count + ' Online';
        if (sidebarCount) sidebarCount.textContent = count;
    }
    update();
    setInterval(update, 45000);
}

// =============================================
// 15. KEYBOARD SHORTCUTS
// =============================================
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
        switch(e.key) {
            case 'ArrowRight': case 'ArrowDown':
                e.preventDefault();
                openTab(null, ALL_TAB_IDS[Math.min(ALL_TAB_IDS.length - 1, currentTabIndex + 1)]);
                break;
            case 'ArrowLeft': case 'ArrowUp':
                e.preventDefault();
                openTab(null, ALL_TAB_IDS[Math.max(0, currentTabIndex - 1)]);
                break;
            case 'Escape':
                e.preventDefault();
                openTab(null, 'tab1');
                showToast('Returned to Home');
                break;
            case '/':
                e.preventDefault();
                var si = document.getElementById('searchInput');
                if (si) { si.classList.add('active'); si.focus(); }
                break;
            case '?':
                openModal('Keyboard Shortcuts ⌨️', `
                    <ul style="line-height:2;font-size:0.9rem;padding-left:1rem;">
                        <li><strong>→ / ↓</strong> — Next tab</li>
                        <li><strong>← / ↑</strong> — Previous tab</li>
                        <li><strong>Esc</strong> — Go to Home</li>
                        <li><strong>/</strong> — Open search</li>
                        <li><strong>?</strong> — This help menu</li>
                    </ul>`);
                break;
        }
    });
}

// =============================================
// =============================================
// 16. SWIPE GESTURES
// =============================================
function initSwipeNavigation() {
    const contentMain = document.querySelector('.content-main');
    if (!contentMain) return;
    var startX = 0, startY = 0, swipeLocked = false;

    function isInsideHScrollable(el, dx) {
        while (el && el !== contentMain) {
            var style = window.getComputedStyle(el);
            var overflowX = style.overflowX;
            var canScrollH = (overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth;
            if (canScrollH) {
                var atLeft  = el.scrollLeft <= 0;
                var atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
                if ((dx < 0 && !atRight) || (dx > 0 && !atLeft)) return true;
            }
            el = el.parentElement;
        }
        return false;
    }

    contentMain.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        swipeLocked = false;
    }, { passive: true });

    contentMain.addEventListener('touchmove', function(e) {
        if (swipeLocked) return;
        var dx = e.touches[0].clientX - startX;
        var dy = e.touches[0].clientY - startY;
        if (Math.abs(dx) > Math.abs(dy) && isInsideHScrollable(e.target, dx)) {
            swipeLocked = true;
        }
    }, { passive: true });

    contentMain.addEventListener('touchend', function(e) {
        if (swipeLocked) return;
        var dx = e.changedTouches[0].clientX - startX;
        var dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > 60 && Math.abs(dy) < 80) {
            if (isInsideHScrollable(e.target, dx)) return;
            if (e.target.closest && e.target.closest('[data-no-swipe]')) return;
            var next = dx < 0 ? Math.min(ALL_TAB_IDS.length - 1, currentTabIndex + 1) : Math.max(0, currentTabIndex - 1);
            openTab(null, ALL_TAB_IDS[next]);
        }
    }, { passive: true });
}

// =============================================
// 17. SIDEBAR TAB FILTER
// =============================================
function initSidebarTabFilter() {
    var filterInput = document.getElementById('sidebarTabSearch');
    if (!filterInput) return;
    filterInput.addEventListener('input', function() {
        var term = this.value.toLowerCase().trim();
        document.querySelectorAll('.sidebar-tabs .tab-button').forEach(function(btn) {
            var name = (btn.getAttribute('data-tab-name') || btn.textContent).toLowerCase();
            btn.style.display = (!term || name.includes(term)) ? '' : 'none';
        });
    });
}

// =============================================
// 18. SERVICE FINDER
// =============================================
function initServiceFinder() { /* CUDWEARS store finder removed: designers now come from Supabase (js/wears.js) */ }

// =============================================
// PWA INSTALL
// =============================================
var deferredPrompt = null;
var installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = 'inline-flex';
});
if (installBtn) {
    installBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function() { deferredPrompt = null; installBtn.style.display = 'none'; });
        }
    });
}

// =============================================
// LIGHTBOX — FIXED: opens in new tab, hides
// Enter button when no real link is set
// =============================================
function openLightbox(src, caption, link) {
    var lb = document.getElementById('imageLightbox');
    if (!lb) return;

    document.getElementById('lightboxImg').src = src;
    document.getElementById('lightboxCaption').textContent = caption;

    var enterBtn = document.getElementById('lightboxEnterBtn');
    // Only show Enter button if a real URL is provided
    var hasRealLink = link && link !== '#' && link.trim() !== '';
    if (hasRealLink) {
        enterBtn.href = link;
        enterBtn.target = '_self';
        enterBtn.rel = '';
   //   enterBtn.rel = 'noopener noreferrer';
        enterBtn.style.display = 'inline-block';
    } else {
        enterBtn.href = '#';
        enterBtn.style.display = 'none';
    }

    lb.style.display = 'flex';
    if (typeof gsap !== 'undefined') {
        gsap.fromTo('.lightbox-content-wrapper', { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4 });
    }
}
function closeLightbox() {
    var lb = document.getElementById('imageLightbox');
    if (!lb) return;
    if (typeof gsap !== 'undefined') {
        gsap.to('.lightbox-content-wrapper', { scale: 0.7, opacity: 0, duration: 0.2, onComplete: function() { lb.style.display = 'none'; } });
    } else { lb.style.display = 'none'; }
}
function closeLightboxOutside(e) {
    if (e.target.id === 'imageLightbox') closeLightbox();
}

// =============================================
// DOM READY — ONE LISTENER
// =============================================
document.addEventListener('DOMContentLoaded', function () {

    // STEP 1: Always open Home first so page is never blank
    var homeBtn = document.querySelector('.nav-item[onclick*="tab1"]');
    if (homeBtn) {
        homeBtn.click();
    } else {
        openTab(null, 'tab1');
    }

    // Restore last visited tab after Home renders
    try {
        var saved = localStorage.getItem('cudfirm_last_tab');
        if (saved && saved !== 'tab1' && document.getElementById(saved)) {
            setTimeout(function() { openTab(null, saved); }, 50);
        }
    } catch(e) {}

    // STEP 2: Store sections for global search
    var contentMain = document.querySelector('.content-main');
    if (contentMain) {
        originalSectionsInOrder = Array.from(contentMain.children).filter(function(n) { return n.tagName === 'SECTION'; });
    }

    // STEP 3: Populate dynamic content
    populateCourseIcons();

    // STEP 4: Global Search
    var searchIcon = document.getElementById('searchIcon');
    var searchInput = document.getElementById('searchInput');
    var searchContainer = document.getElementById('searchContainer');
    var clearSearchBtn = document.getElementById('clearSearchBtn');

    if (searchIcon && searchInput) {
        searchIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            searchInput.classList.toggle('active');
            if (searchInput.classList.contains('active')) { searchInput.focus(); }
            else if (searchInput.value && clearSearchBtn) { clearSearchBtn.click(); }
        });
    }
    if (clearSearchBtn && searchInput) {
        clearSearchBtn.addEventListener('click', function() {
            searchInput.value = '';
            this.style.display = 'none';
            filterContent('');
            searchInput.focus();
        });
    }
    if (searchInput && clearSearchBtn) {
        searchInput.addEventListener('input', function() {
            clearSearchBtn.style.display = this.value ? 'block' : 'none';
            filterContent(this.value);
        });
    }
    if (searchContainer && searchInput) {
        document.addEventListener('click', function(e) {
            if (!searchContainer.contains(e.target) && searchInput.classList.contains('active')) {
                searchInput.classList.remove('active');
            }
        });
    }

    // STEP 5: View-specific search
    document.querySelectorAll('.view-search').forEach(function(input) {
        input.addEventListener('input', handleViewSearch);
    });

    // STEP 6: Modal close
    var modal = document.getElementById('modal');
    var modalCloseBtn = document.querySelector('.modal-close');
    if (modal && modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });
    }

    // STEP 7: Lightbox on Home images
    document.querySelectorAll('#tab1 .grid-item:not([data-filter]) img').forEach(function(img) {
        img.addEventListener('click', function() {
            openLightbox(this.src, this.alt || 'View Item', this.getAttribute('data-link') || '#');
        });
    });

    // STEP 8: All new features
    initDarkMode();
    initReadingProgressBar();
    initBackToTop();
    initLiveUserCount();
    initKeyboardShortcuts();
    /* swipe-to-switch-tabs removed */
    initSidebarTabFilter();
    initServiceFinder();

    // STEP 9: First-visit hint toast
    try {
        if (!localStorage.getItem('cudfirm_hint_shown')) {
            setTimeout(function() {
                if (!window.matchMedia('(pointer: coarse)').matches) showToast('Tip: Press ? for keyboard shortcuts ⌨️', 4000);
                localStorage.setItem('cudfirm_hint_shown', '1');
            }, 3000);
        }
    } catch(e) {}

});

