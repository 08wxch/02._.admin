/* ── 02._.admin — หลังบ้านเดียวจบ (ดึงข้อมูลจาก 02._.mock) ── */

import { CONFIG } from './config.js';
import * as data from './data.js';
import { closeModal, confirmDialog, openModal, toast } from './ui.js';
import { e, formatNumber } from './utils.js';
import { renderAdmin } from './views/admin.js';
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

/* ── เลย์เอาต์คอนโซล + แถบบน ───────────────────────────── */
export function consoleLayout({ items = [], title = '', subtitle = '', body = '' }) {
  const acc = data.getAccount() || {};
  return `
  <div class="console__top">
    <a class="brand brand--default" href="#/dashboard">
      <span class="brand-mark brand-mark--sm"><img src="./assets/brand/logo-circle.png" alt=""></span>
      <span class="brand__words"><span class="brand__name">02._.admin</span>
        <span class="brand__sub">${acc.role === 'owner' ? 'เจ้าของระบบ' : 'ครู'}</span></span>
    </a>
    <div class="console__top-right">
      <button class="profile-btn" id="profile-btn" title="ข้อมูลของฉัน">
        <span class="avatar avatar--md" style="width:30px;height:30px">${e((acc.name || '?').trim().charAt(0))}</span>
        <span class="profile-btn__text">
          <b>${e(acc.name || acc.teacher_code || '')}</b>
          <span class="tiny dim">${acc.role === 'owner' ? 'เจ้าของระบบ' : 'ครู'}</span>
        </span>
      </button>
    </div>
  </div>
  <div class="console">
    <aside class="console__nav">
      <div class="console__eyebrow">เมนูจัดการ</div>
      ${items.map((it) => `
        <a href="${it.href}" class="${it.active ? 'is-active' : ''}"${it.active ? ' aria-current="page"' : ''}>
          <span>${e(it.label)}</span>
          ${it.count ? `<span class="count">${e(String(it.count))}</span>` : ''}
        </a>`).join('')}
    </aside>
    <section class="console__main">
      ${title ? `<h1 class="console__title">${e(title)}</h1>` : ''}
      ${subtitle ? `<p class="console__sub">${subtitle}</p>` : ''}
      ${body}
    </section>
  </div>`;
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
        ? `<div class="kv"><span>รหัสครู</span><b>${e(acc.teacher_code || '—')}</b></div>`
        : `<div class="kv"><span>อีเมล</span><b>${e(acc.email || '—')}</b></div>`}
      <div class="field-row" style="margin-top:10px"><label>ชื่อที่แสดง</label>
        <input id="pf-name" value="${e(acc.name || '')}" maxlength="80"></div>
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
  data, me: null, settings, money, baht, statusBadge, consoleLayout,
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
    const html = await match.view(arg, { ...ctx, me, settings, route });
    if (html) app.innerHTML = html;
    document.getElementById('profile-btn')?.addEventListener('click', openProfile);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="console__main"><div class="empty-soft"><b>โหลดไม่สำเร็จ</b>
      <p class="tiny dim">${e(err.message || '')}</p></div></div>`;
  }
}

function renderHeaderState() {
  // ไม่มี header เว็บใน 02._.admin — ใช้แถบบนของคอนโซลที่มากับแต่ละหน้า
}

async function boot() {
  try { await data.init(); } catch (err) { console.error('เชื่อมต่อฐานข้อมูลไม่สำเร็จ', err); }
  me = data.getAccount();
  ctx.me = me;
  try { settings = await data.getSettings(); ctx.settings = settings; } catch (err) { /* ignore */ }

  data.onChange(async () => {
    me = data.getAccount();
    ctx.me = me;
    try { settings = await data.getSettings(); ctx.settings = settings; } catch (err) { /* ignore */ }
    await render();
  });
  window.addEventListener('hashchange', render);
  await render();
}

boot();
