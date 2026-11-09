/* ── 02._.admin — หลังบ้านเดียวจบ (ดึงข้อมูลจาก 02._.mock) ── */

import { CONFIG } from './config.js';
import * as data from './data.js';
import { closeModal, confirmDialog, openModal, toast } from './ui.js';
import { e, formatNumber } from './utils.js';
import { buildMenu, renderAdmin } from './views/admin.js';
import { renderStudents } from './views/students.js';
import { renderTeacherAuth } from './views/auth.js';

const app = document.getElementById('app');
let me = null;
let settings = {};

export const money = (n) => formatNumber(Number(n || 0));
export const baht = (n) => `฿${money(n)}`;
export const statusBadge = (s) => {
  const map = {
    pending_payment: ['ยังไม่ชำระ', 'chip--mute'],
    pending_confirm: ['รอยืนยัน', 'chip--warn'],
    confirmed: ['ยืนยันแล้ว', 'chip--ok'],
    rejected: ['ไม่ผ่าน', 'chip--bad'],
  };
  const [label, cls] = map[s] || ['—', 'chip--mute'];
  return `<span class="chip ${cls}">${label}</span>`;
};


/* การ์ดคอร์สสำหรับหน้าตัวอย่าง (เหมือนที่ผู้ปกครองเห็น) */
function courseCardForAdmin(c) {
  const left = c.seats ? `${c.left ?? c.seats} ที่นั่ง` : 'ไม่จำกัด';
  const low = c.seats && (c.left ?? c.seats) <= 2;
  return `
  <a class="course-card" href="#/course/${c.id || ''}">
    <div class="course-card__media">
      ${c.image_url
        ? `<img src="${e(c.image_url)}" alt="" loading="lazy">`
        : `<div class="course-card__placeholder">${e((c.subject || 'คอร์ส').slice(0, 12))}</div>`}
    </div>
    <div class="course-card__body">
      <div class="tiny dim">${e(c.level || c.subject || '')}</div>
      <h3>${e(c.title || 'ชื่อคอร์ส')}</h3>
      <p class="tiny dim" style="margin:0">${e(c.subtitle || '')}</p>
      <div class="course-card__foot">
        <span class="price">${baht(c.price || 0)}</span>
        <span class="seat-badge${low ? ' is-low' : ''}">${e(left)}</span>
      </div>
    </div>
  </a>`;
}


/* การ์ดคูปองสำหรับหน้าตัวอย่าง (เหมือนที่ผู้ปกครองเห็นใน 02._.book) */
function couponCardForAdmin(c, courses = []) {
  const value = c.kind === 'amount' ? baht(c.value || 0) : `${c.value || 0}%`;
  const scope = (c.course_ids || []).length
    ? (c.course_ids || []).map((id) => courses.find((x) => x.id === id)?.title || 'คอร์ส').slice(0, 2).join(' · ')
    : 'ทุกคอร์ส';
  return `
  <article class="coupon-card ${c.image_url ? 'has-image' : ''}">
    ${c.image_url
      ? `<img class="coupon-card__img" src="${e(c.image_url)}" alt=""><div class="coupon-card__state"><span class="chip chip--ok">ใช้ได้</span></div>`
      : `<div class="coupon-card__body">
           <div class="coupon-card__value">${e(value)}</div>
           <div class="coupon-card__text">
             <div class="coupon-card__title">${e(c.title || c.code || 'ชื่อคูปอง')}</div>
             <div class="tiny dim">${e(scope)}</div>
             <div class="tiny dim">${c.expires_at ? 'มีวันหมดอายุ' : 'ไม่มีวันหมดอายุ'}</div>
           </div>
           <div class="coupon-card__right"><span class="chip chip--ok">ใช้ได้</span></div>
         </div>`}
  </article>`;
}

/* ── เลย์เอาต์คอนโซล: แถบดำซ้าย + แถบบนขาว (แบบ 02._.mock) ── */
const NAV_ICONS = {
  orders: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  courses: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  coupons: '<path d="M20 12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2"/><path d="M4 12a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2"/><path d="M12 2v20"/>',
  teachers: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  parents: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>',
  students: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};

const navIcon = (key, size = 18) => `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NAV_ICONS[key] || NAV_ICONS.courses}</svg>`;

export function consoleLayout({ items = [], title = '', subtitle = '', body = '', breadcrumb = '' }) {
  const acc = data.getAccount() || {};
  const identity = acc.name || acc.teacher_code || '';
  const roleLabel = acc.role === 'owner' ? 'เจ้าของระบบ' : 'ครู';
  const orgLabel = acc.org_hint || '';

  const renderGroup = (list) => list.map((it) => `
    <a href="${it.href}" class="${it.active ? 'is-active' : ''}"${it.active ? ' aria-current="page"' : ''}>
      ${navIcon(it.icon)}<span>${e(it.label)}</span>
      ${it.count ? `<span class="side-nav__badge">${e(String(it.count))}</span>` : ''}
    </a>`).join('');

  const main = items.filter((i) => !i.group);
  const people = items.filter((i) => i.group === 'people');
  const config = items.filter((i) => i.group === 'config');

  return `
  <div class="teacher-app">
    <aside class="teacher-sidebar" id="console-nav">
      <div class="sidebar__brand">
        <a class="brand brand--light" href="#/dashboard" style="text-decoration:none">
          <span class="brand-mark brand-mark--sm"><img src="./assets/brand/logo-circle.png" alt=""></span>
          <span class="brand__words"><span class="brand__name">02._.admin</span>
            <span class="brand__sub">หลังบ้านเจ้าของระบบ</span></span>
        </a>
        <button class="nav-close nav-close--dark" id="console-nav-close" type="button" aria-label="ปิดเมนู">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      <div class="sidebar__label">พื้นที่ทำงาน</div>
      <nav class="side-nav" aria-label="เมนูจัดการ">${renderGroup(main)}</nav>

      ${people.length ? `<div class="sidebar__divider"></div>
        <div class="sidebar__label">บุคลากรและนักเรียน</div>
        <nav class="side-nav">${renderGroup(people)}</nav>` : ''}

      ${config.length ? `<div class="sidebar__divider"></div>
        <div class="sidebar__label">ระบบ</div>
        <nav class="side-nav">${renderGroup(config)}</nav>` : ''}

      <div class="sidebar-profile">
        <button class="sidebar-profile__copy" type="button" id="profile-btn" title="ข้อมูลของฉัน">
          <span class="avatar avatar--md" style="width:32px;height:32px">${e((identity.trim().charAt(0) || '?').toUpperCase())}</span>
          <span class="sidebar-profile__text">
            <strong>${e(identity)}</strong>
            <span>${e(orgLabel || roleLabel)}</span>
          </span>
        </button>
        <div class="sidebar-profile__actions">
          <button class="icon-btn" type="button" data-signout title="ออกจากระบบ" aria-label="ออกจากระบบ">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
          </button>
        </div>
      </div>
    </aside>

    <div class="teacher-main">
      <header class="teacher-topbar">
        <button class="icon-btn teacher-topbar__menu" type="button" id="console-nav-toggle" aria-label="เปิดเมนู">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <div class="breadcrumb">${breadcrumb || 'หลังบ้าน'}</div>
      </header>

      <main class="teacher-content">
        ${title ? `<h1 class="console__title">${e(title)}</h1>` : ''}
        ${subtitle ? `<p class="console__sub">${subtitle}</p>` : ''}
        ${body}
      </main>
    </div>
  </div>
  <div class="sidebar-backdrop" id="console-scrim"></div>`;
}
/* ── โปรไฟล์ของฉัน (แก้ข้อมูล/รหัสผ่าน) ────────────────── */
export function openProfile() {
  const acc = data.getAccount() || {};
  const isTeacher = acc.role === 'owner' || acc.role === 'teacher';
  openModal({
    title: 'ข้อมูลของฉัน',
    size: 'sm',
    body: `
      <div class="kv"><span>บทบาท</span><b>${isTeacher ? (acc.role === 'owner' ? 'เจ้าของระบบ' : 'ครู') : 'ผู้ปกครอง'}</b></div>
      ${isTeacher
        ? `<div class="kv"><span>บัญชี (รหัสครูจาก 02._.mock)</span><b>${e(acc.teacher_code || '—')}</b></div>`
        : `<div class="kv"><span>อีเมล</span><b>${e(acc.email || '—')}</b></div>`}
      <div class="field-row" style="margin-top:10px"><label>ชื่อที่แสดง (ไม่บังคับ)</label>
        <input id="pf-name" value="${e(acc.name || '')}" maxlength="80" placeholder="เว้นว่างไว้ก็ได้ — ระบบจะใช้รหัสครูแทน"></div>
      <div class="field-row"><label>เบอร์โทร</label>
        <input id="pf-phone" value="${e(acc.phone || '')}" maxlength="32" placeholder="089-123-4567"></div>
      <div class="field-row"><label>LINE ID</label>
        <input id="pf-line" value="${e(acc.line_id || '')}" maxlength="60"></div>
      <button class="btn btn-ghost btn-block btn-sm" id="pf-save">บันทึกข้อมูล</button>

      <div style="border-top:1px solid var(--book-line);margin-top:16px;padding-top:14px">
        <div style="font-family:var(--brand-font);font-size:15px;margin-bottom:8px">เปลี่ยนรหัสผ่าน</div>
        <div class="field-row"><label>รหัสผ่านใหม่</label>
          <input id="pf-pass" type="password" autocomplete="new-password" placeholder="อย่างน้อย 6 ตัวอักษร"></div>
        <div class="field-row"><label>ยืนยันรหัสผ่านใหม่</label>
          <input id="pf-pass2" type="password" autocomplete="new-password" placeholder="พิมพ์ซ้ำ"></div>
        <button class="btn btn-primary btn-block btn-sm" id="pf-pass-save">เปลี่ยนรหัสผ่าน</button>
        ${isTeacher ? `<p class="hint" style="margin-top:8px">การเปลี่ยนรหัสที่นี่จะมีผลกับ 02._.mock ด้วย (ใช้รหัสเดียวกัน)</p>` : ''}
      </div>`,
    footer: `<button class="btn btn-ghost" type="button" data-signout>ออกจากระบบ</button>
             <button class="btn btn-ghost" type="button" data-modal-close>ปิด</button>`,
    onMount: (root) => {
      root.querySelector('#pf-save')?.addEventListener('click', async (ev) => {
        ev.currentTarget.disabled = true;
        try {
          await data.updateAccount({
            name: root.querySelector('#pf-name').value.trim(),
            phone: root.querySelector('#pf-phone').value.trim(),
            line_id: root.querySelector('#pf-line').value.trim(),
          });
          toast('บันทึกแล้ว', 'success');
          render();
        } catch (err) { toast(err.message || 'บันทึกไม่สำเร็จ', 'error'); }
        finally { ev.currentTarget.disabled = false; }
      });
      root.querySelector('#pf-pass-save')?.addEventListener('click', async (ev) => {
        const p1 = root.querySelector('#pf-pass').value;
        const p2 = root.querySelector('#pf-pass2').value;
        if (p1.length < 6) { toast('รหัสผ่านอย่างน้อย 6 ตัวอักษร', 'error'); return; }
        if (p1 !== p2) { toast('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'error'); return; }
        ev.currentTarget.disabled = true;
        try {
          await data.changeTeacherPassword(p1);
          toast('เปลี่ยนรหัสผ่านแล้ว (ใช้กับ 02._.mock ด้วย)', 'success');
        } catch (err) { toast(err.message || 'ไม่สำเร็จ', 'error'); }
        finally { ev.currentTarget.disabled = false; }
      });
      root.querySelector('[data-signout]')?.addEventListener('click', async () => {
        const ok = await confirmDialog({ title: 'ออกจากระบบ', message: 'ต้องการออกจากระบบใช่ไหม?', confirmLabel: 'ออกจากระบบ' });
        if (!ok) return;
        await data.signOut();
        closeModal();
        location.hash = '#/login';
      });
    },
  });
}

/* ── router ───────────────────────────────────────────── */
function parse() {
  const raw = (location.hash || '#/').replace(/^#/, '');
  const [path, query = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(query), parts: path.split('/').filter(Boolean) };
}

const ctx = {
  data, me: null, settings, money, baht, statusBadge, consoleLayout, courseCardForAdmin,
  menuItems: (active) => buildMenu(active, data.getAccount()?.role === 'owner'), couponCardForAdmin,
  go: (p) => { location.hash = `#${p}`; },
};

const ROUTES = [
  { test: (p) => p === '/login', view: renderTeacherAuth, anon: true },
  { test: (p) => p === '/dashboard' || p === '/admin', view: renderAdmin },
  { test: (p) => p === '/students', view: renderStudents },
  { test: (p) => p.startsWith('/students/'), view: renderStudents, key: 1 },
];

async function render() {
  const route = parse();
  document.body.dataset.shell = 'console';
  renderHeaderState();
  const match = ROUTES.find((r) => r.test(route.path));

  if (!me && !match?.anon) { location.hash = '#/login'; return; }
  if (me && match?.anon) { location.hash = '#/dashboard'; return; }
  if (!match) { location.hash = me ? '#/dashboard' : '#/login'; return; }

  app.innerHTML = '<div class="page-loader"><span class="spinner"></span></div>';
  try {
    const arg = match.key ? route.parts[match.key] : null;
    const html = await match.view(arg, { ...ctx, me, settings, route, blocked: blockedMessage });
    if (html) app.innerHTML = html;
    document.getElementById('profile-btn')?.addEventListener('click', openProfile);
    bindConsoleNav();
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="console__main"><div class="empty-soft"><b>โหลดไม่สำเร็จ</b>
      <p class="tiny dim">${e(err.message || '')}</p></div></div>`;
  }
}

function bindConsoleNav() {
  const toggle = document.getElementById('console-nav-toggle');
  const nav = document.getElementById('console-nav');
  const scrim = document.getElementById('console-scrim');
  const backdrop = document.getElementById('console-scrim');
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    document.body.classList.toggle('sidebar-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  if (toggle.dataset.bound) return;
  toggle.dataset.bound = '1';

  // ปุ่มออกจากระบบ (ท้ายแถบดำ) — ต้องยืนยันก่อน
  const logoutBtn = document.querySelector('.sidebar-profile__actions [data-signout]');
  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = '1';
    logoutBtn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'ออกจากระบบ',
        message: 'ต้องการออกจากระบบใช่ไหม?',
        confirmLabel: 'ออกจากระบบ',
      });
      if (!ok) return;
      await data.signOut();
      location.hash = '#/login';
    });
  }
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  document.getElementById('console-nav-close')?.addEventListener('click', () => setOpen(false));
  scrim?.addEventListener('click', () => setOpen(false));
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
}

function renderHeaderState() {
  // ไม่มี header เว็บใน 02._.admin — ใช้แถบบนของคอนโซลที่มากับแต่ละหน้า
}

let blockedMessage = '';

/** เฉพาะครู/เจ้าของระบบเท่านั้นที่เข้า 02._.admin ได้ */
async function enforceStaffOnly() {
  const acc = data.getAccount();
  if (acc && acc.role === 'parent') {
    const email = acc.email || '';
    await data.signOut();
    me = null;
    ctx.me = null;
    blockedMessage = `บัญชีผู้ปกครอง (${email}) เข้าใช้งานหลังบ้านไม่ได้ — กรุณาล็อกอินด้วยบัญชีครู/เจ้าของระบบ`;
    return false;
  }
  return true;
}

async function boot() {
  try { await data.init(); } catch (err) { console.error('เชื่อมต่อฐานข้อมูลไม่สำเร็จ', err); }
  me = data.getAccount();
  ctx.me = me;
  await enforceStaffOnly();
  try { settings = await data.getSettings(); ctx.settings = settings; } catch (err) { /* ignore */ }

  data.onChange(async () => {
    me = data.getAccount();
    ctx.me = me;
    await enforceStaffOnly();
    try { settings = await data.getSettings(); ctx.settings = settings; } catch (err) { /* ignore */ }
    await render();
  });
  window.addEventListener('hashchange', render);
  await render();
}

boot();
