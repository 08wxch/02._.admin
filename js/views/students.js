/* ── รายชื่อนักเรียน (เจ้าของ/ครู) + ผูกผู้ปกครอง ───────── */

import { closeModal, confirmDialog, openModal, toast } from '../ui.js';
import { e, thaiDate } from '../utils.js';

import { hydrateMath } from '../latex.js';
import { studentOverviewHtml } from './account.js';

export async function renderStudents(studentId, ctx) {
  if (!ctx.me || (ctx.me.role !== 'owner' && ctx.me.role !== 'teacher')) {
    location.hash = '#/'; return '';
  }
  return studentId ? studentDetail(studentId, ctx) : studentList(ctx);
}

/* ── รายการนักเรียน ───────────────────────────────────── */
async function studentList(ctx) {
  const [students, orgs, parents] = await Promise.all([
    ctx.data.studentsOverview().catch(() => []),
    ctx.data.listOrganizations().catch(() => []),
    ctx.data.listParents().catch(() => []),
  ]);

  const myOrg = ctx.me.org_id || '';
  const orgFilter = ctx.route?.query.get('org') || (ctx.me.role === 'teacher' ? myOrg : '');
  const shown = orgFilter ? students.filter((s) => s.orgId === orgFilter) : students;
  const linked = shown.filter((s) => (s.parents || []).length).length;

  const orgName = (id) => orgs.find((o) => o.id === id)?.name || id || '—';

  const rows = shown.map((s) => `
    <div class="student-row">
      <a class="student-row__main" href="#/students/${encodeURIComponent(s.id)}">
        <span class="student-row__avatar">${e((s.name || '?').trim().charAt(0))}</span>
        <span class="student-row__name">
          <b>${e(s.name || s.id)}</b>
          <span class="tiny dim">${e(s.code || '')}${s.class ? ` · ${e(s.class)}` : ''} · ${e(orgName(s.orgId))}</span>
        </span>
      </a>
      <div class="student-row__parents">
        ${(s.parents || []).length
          ? s.parents.map((p) => `<button class="parent-chip" data-parent="${p.user_id}">
              ${e(p.name || p.email)}<span class="tiny dim"> ${e(p.phone || '')}</span></button>`).join('')
          : '<span class="tiny dim">ยังไม่มีผู้ปกครอง</span>'}
      </div>
      <button class="btn btn-ghost btn-sm" data-add-parent="${s.id}">
        ${(s.parents || []).length ? 'เพิ่มผู้ปกครอง' : '+ เพิ่มผู้ปกครอง'}
      </button>
    </div>`).join('');

  setTimeout(() => {
    const root = document.getElementById('app');
    root.querySelector('#org-filter')?.addEventListener('change', (ev) => {
      location.hash = `#/students?org=${encodeURIComponent(ev.currentTarget.value)}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    root.querySelectorAll('[data-add-parent]').forEach((btn) => {
      btn.addEventListener('click', () => openLinkModal(btn.dataset.addParent, students, parents, ctx));
    });
    root.querySelectorAll('[data-parent]').forEach((btn) => {
      btn.addEventListener('click', () => openParentDetail(btn.dataset.parent, ctx));
    });
  }, 0);

  return ctx.consoleLayout({
    items: ctx.menuItems ? ctx.menuItems('students') : [],
    title: 'รายชื่อนักเรียน',
    subtitle: 'กดที่ชื่อนักเรียนเพื่อดูคะแนนและข้อมูล · ด้านขวาคือบัญชีผู้ปกครองที่ผูกอยู่',
    body: `
      <div class="stat-row">
        <div class="stat-card"><div class="k">นักเรียนในระบบ</div><div class="v">${shown.length}<small>คน</small></div></div>
        <div class="stat-card"><div class="k">ผูกผู้ปกครองแล้ว</div><div class="v">${linked}<small>คน</small></div></div>
        <div class="stat-card"><div class="k">ยังไม่มีผู้ปกครอง</div><div class="v">${shown.length - linked}<small>คน</small></div></div>
      </div>

      ${ctx.me.role === 'owner' ? `
      <div class="book-card" style="margin-bottom:14px;padding:14px 16px">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <label class="tiny dim" for="org-filter">กรองตามหน่วยงาน/โรงเรียน</label>
          <select id="org-filter" style="min-width:260px">
            <option value="">ทั้งหมด (${students.length} คน)</option>
            ${orgs.map((o) => `<option value="${o.id}" ${orgFilter === o.id ? 'selected' : ''}>${e(o.name)}</option>`).join('')}
          </select>
        </div>
      </div>` : ''}

      ${shown.length ? `<div class="book-card" style="padding:8px 10px">${rows}</div>`
        : `<div class="empty-soft"><b>ยังไม่มีนักเรียนในหน่วยงานนี้</b>
             <p class="tiny dim" style="margin:0">เพิ่มนักเรียนได้ที่ระบบ 02._.mock แล้วกลับมาโหลดใหม่</p></div>`}
    `,
  });
}



/** เปิดหน้าต่างเลือกผู้ปกครอง เพื่อผูกกับนักเรียนคนนี้ */
export async function openAddParentForStudent(studentId, ctx) {
  let parents = [];
  try { parents = await ctx.data.listParents(); } catch (err) { parents = []; }
  if (!parents.length) { toast('ยังไม่มีบัญชีผู้ปกครองในระบบ', 'error'); return; }

  openModal({
    title: 'เพิ่มผู้ปกครองให้นักเรียน',
    size: 'sm',
    body: `
      <input class="input" id="ap-search" placeholder="ค้นหาชื่อ/อีเมล/เบอร์" style="margin-bottom:10px">
      <div class="school-list" id="ap-list">
        ${parents.map((p) => `<button class="pick-row" data-pick-parent="${p.user_id}">
          <b>${e(p.name || p.email)}</b>
          <span class="tiny dim">${e(p.email || '')}${p.phone ? ` · ${e(p.phone)}` : ''}${p.line_id ? ` · ${e(p.line_id)}` : ''}</span>
        </button>`).join('')}
      </div>`,
    onMount: (root) => {
      const search = root.querySelector('#ap-search');
      search?.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        root.querySelectorAll('[data-pick-parent]').forEach((el) => {
          el.style.display = el.innerText.toLowerCase().includes(q) ? '' : 'none';
        });
      });
      root.querySelectorAll('[data-pick-parent]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            await ctx.data.linkParentStudent(studentId, btn.dataset.pickParent);
            toast('ผูกผู้ปกครองแล้ว', 'success');
            closeModal();
            location.reload();
          } catch (err) {
            btn.disabled = false;
            toast(err.message || 'ผูกไม่สำเร็จ', 'error');
          }
        });
      });
    },
  });
}

/** เปิดหน้าต่างเลือกนักเรียนในหน่วยงาน เพื่อผูกกับบัญชีผู้ปกครองคนนี้ */
export async function openAddStudent(parentId, ctx) {
  let roster = { students: [] };
  try { roster = await ctx.data.listMockRoster(); } catch (err) { roster = { students: [] }; }
  const students = roster?.students || [];
  const orgName = (id) => ((roster.organizations || []).find((o) => o.id === id)?.name || id || '');

  openModal({
    title: 'เพิ่มบัญชีนักเรียน',
    size: 'sm',
    body: `
      <p class="tiny dim" style="margin:0 0 10px">เลือกนักเรียนในหน่วยงานของคุณ เพื่อผูกกับบัญชีผู้ปกครองคนนี้</p>
      ${students.length ? `
        <input class="input" id="as-search" placeholder="ค้นหาชื่อ/รหัสนักเรียน" style="margin-bottom:10px">
        <div class="school-list" id="as-list">
          ${students.map((s) => `<button class="pick-row" data-pick-student="${s.id}">
            <b>${e(s.name || s.id)}</b>
            <span class="tiny dim">${e(s.code || '')}${s.class ? ` · ${e(s.class)}` : ''}${s.orgName || orgName(s.orgId) ? ` · ${e(s.orgName || orgName(s.orgId))}` : ''}</span>
          </button>`).join('')}
        </div>`
        : '<p class="tiny dim">ยังไม่มีนักเรียนในหน่วยงานของคุณ — เพิ่มนักเรียนใน 02._.mock ก่อน</p>'}
      <p class="hint" style="margin-top:10px">ถ้าต้องการเพิ่มหลายคน ทำให้ทีละคนได้เลย</p>`,
    onMount: (root) => {
      const search = root.querySelector('#as-search');
      search?.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        root.querySelectorAll('[data-pick-student]').forEach((el) => {
          el.style.display = el.innerText.toLowerCase().includes(q) ? '' : 'none';
        });
      });
      root.querySelectorAll('[data-pick-student]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            await ctx.data.linkParentStudent(btn.dataset.pickStudent, parentId);
            toast('ผูกนักเรียนให้ผู้ปกครองแล้ว', 'success');
            closeModal();
            location.reload();
          } catch (err) {
            btn.disabled = false;
            toast(err.message || 'ผูกไม่สำเร็จ', 'error');
          }
        });
      });
    },
  });
}

/* ── รายละเอียดนักเรียน: คะแนน + กราฟ + ผู้ปกครอง ──────── */
async function studentDetail(studentId, ctx) {
  const [report, students, parents] = await Promise.all([
    ctx.data.studentReport(studentId).catch(() => null),
    ctx.data.studentsOverview().catch(() => []),
    ctx.data.listParents().catch(() => []),
  ]);

  const row = students.find((s) => s.id === studentId) || {};
  if (!report && !row.id) {
    return ctx.consoleLayout({
      items: ctx.menuItems('students'),
      title: 'ไม่พบนักเรียนคนนี้',
      body: '<a class="btn btn-ghost btn-sm" href="#/dashboard?tab=students">กลับรายชื่อนักเรียน</a>',
    });
  }
  const linked = row.parents || [];

  setTimeout(() => {
    const root = document.getElementById('app');
    root.querySelector('#d-add-parent')?.addEventListener('click', () => openLinkModal(studentId, students, parents, ctx));
    root.querySelectorAll('[data-parent]').forEach((btn) => {
      btn.addEventListener('click', () => openParentDetail(btn.dataset.parent, ctx));
    });
    root.querySelectorAll('[data-unlink]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'ถอดผู้ปกครองออก',
          message: 'ผู้ปกครองคนนี้จะไม่เห็นข้อมูลของนักเรียนคนนี้อีก (บัญชีนักเรียนไม่หาย)',
          confirmLabel: 'ถอดออก', tone: 'danger',
        });
        if (!ok) return;
        try {
          await ctx.data.unlinkStudent(btn.dataset.unlink);
          toast('ถอดผู้ปกครองแล้ว', 'success');
          location.reload();
        } catch (err) { toast(err.message || 'ไม่สำเร็จ', 'error'); }
      });
    });
  }, 0);

  return ctx.consoleLayout({
    items: ctx.menuItems('students'),
    title: report?.student?.name || row.name || '',
    subtitle: '',
    body: `
      <div class="detail-2col">
        <div>
          ${report
            ? studentOverviewHtml(report, ctx, { studentId, hideExamLinks: true })
            : '<div class="empty-soft"><b>ยังไม่มีผลการสอบของนักเรียนคนนี้</b></div>'}
        </div>
        <aside class="book-card" style="height:fit-content">
          <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:4px">บัญชีผู้ปกครองที่ผูกไว้</div>
          <p class="tiny dim" style="margin:0 0 12px">นักเรียน 1 คนผูกได้มากกว่า 1 บัญชี</p>
          ${linked.length ? linked.map((p) => `
            <div class="parent-line" data-parent="${p.user_id}">
              <div>
                <b>${e(p.name || p.email)}</b>
                <div class="tiny dim">${e(p.phone || '')}${p.line_id ? ` · ${e(p.line_id)}` : ''}</div>
              </div>
              <button class="btn btn-ghost btn-sm" data-unlink="${p.link_id}" style="color:var(--red)">ถอด</button>
            </div>`).join('')
            : '<p class="tiny dim">ยังไม่มีผู้ปกครองผูกกับนักเรียนคนนี้</p>'}
          <button class="btn btn-primary btn-block btn-sm" id="d-add-parent" style="margin-top:12px">+ เพิ่มผู้ปกครอง</button>
        </aside>
      </div>`,
  });
}

/* ── เลือกผู้ปกครองมาผูก ───────────────────────────────── */
function openLinkModal(studentId, students, parents, ctx) {
  if (!parents.length) {
    toast('ยังไม่มีบัญชีผู้ปกครองในระบบ', 'error');
    return;
  }
  const student = students.find((s) => s.id === studentId);
  const linkedIds = new Set((student?.parents || []).map((p) => p.user_id));
  const list = parents.filter((p) => !linkedIds.has(p.user_id));

  openModal({
    title: 'เพิ่มผู้ปกครองให้นักเรียน',
    size: 'sm',
    body: `
      <p class="tiny dim" style="margin:0 0 10px">นักเรียน: <b>${e(student?.name || studentId)}</b></p>
      ${list.length ? `
        <input class="input" id="lp-search" placeholder="ค้นหาชื่อ/อีเมล/เบอร์" style="margin-bottom:10px">
        <div class="school-list" id="lp-list">
          ${list.map((p) => `<button class="pick-row" data-pick="${p.user_id}">
            <b>${e(p.name || p.email)}</b>
            <span class="tiny dim">${e(p.email || '')}${p.phone ? ` · ${e(p.phone)}` : ''}${p.line_id ? ` · ${e(p.line_id)}` : ''}</span>
          </button>`).join('')}
        </div>`
        : '<p class="tiny dim">ผู้ปกครองทุกคนถูกผูกกับนักเรียนคนนี้แล้ว</p>'}
      <p class="hint" style="margin-top:10px">ถ้าผู้ปกครองยังไม่มีบัญชี ให้เขาสมัครที่หน้าเข้าสู่ระบบก่อน แล้วกลับมาเพิ่มที่นี่</p>`,
    onMount: (root) => {
      const search = root.querySelector('#lp-search');
      search?.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        root.querySelectorAll('[data-pick]').forEach((el) => {
          const hit = el.innerText.toLowerCase().includes(q);
          el.style.display = hit ? '' : 'none';
        });
      });
      root.querySelectorAll('[data-pick]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            await ctx.data.linkParentStudent(studentId, btn.dataset.pick);
            toast('ผูกผู้ปกครองแล้ว', 'success');
            closeModal();
            location.reload();
          } catch (err) {
            btn.disabled = false;
            toast(err.message || 'ผูกไม่สำเร็จ', 'error');
          }
        });
      });
    },
  });
}

/* ── รายละเอียดผู้ปกครอง (ดู/แก้รหัส/ลบ) ───────────────── */
export async function openParentDetail(userId, ctx) {
  let data;
  let orgs = [];
  try {
    [data, orgs] = await Promise.all([ctx.data.parentDetail(userId), ctx.data.listOrganizations().catch(() => [])]);
  } catch (err) {
    toast(err.message || 'โหลดข้อมูลผู้ปกครองไม่สำเร็จ', 'error');
    return;
  }
  const orgNameOf = (id) => orgs.find((o) => o.id === id)?.name || id;

  openModal({
    title: data.name || data.email || 'ผู้ปกครอง',
    size: 'md',
    body: `
      <div class="kv"><span>อีเมล</span><b>${e(data.email || '—')}</b></div>
      <div class="kv"><span>เบอร์โทร</span><b>${e(data.phone || '—')}</b></div>
      <div class="kv"><span>LINE</span><b>${e(data.line_id || '—')}</b></div>
      <div class="kv"><span>ชำระแล้วรวม</span><b>฿${ctx.money(data.total_paid || 0)}</b></div>

      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px">
        <div class="tiny dim">นักเรียนที่ผูกไว้ (${(data.students || []).length})</div>
        <button class="btn btn-primary btn-sm" id="pd-add-student">+ เพิ่มนักเรียน</button>
      </div>
      <div class="school-list" style="margin-top:6px">
        ${(data.students || []).length ? (data.students || []).map((s) => `
          <div class="parent-line">
            <div><b>${e(s.student_name || s.student_id)}</b>
              <div class="tiny dim">${e(s.student_code || '')} · ${e(s.org_name || s.org_id || '')}</div></div>
            <button class="btn btn-ghost btn-sm" data-unlink="${s.link_id}" style="color:var(--red)">ถอด</button>
          </div>`).join('') : '<span class="tiny dim">ยังไม่มีนักเรียน</span>'}
      </div>

      <div style="margin-top:16px;border-top:1px solid var(--book-line);padding-top:14px">
        <div class="tiny dim" style="margin-bottom:6px">โรงเรียน/หน่วยงานที่ผู้ปกครองเลือกไว้</div>
        <div id="pd-orgs" style="display:flex;flex-wrap:wrap;gap:6px">
          ${((data.org_ids || []).length ? data.org_ids.map((id) => `
            <span class="chip chip--mute">${e(orgNameOf(id))}
              <button data-drop-org="${id}" style="border:0;background:none;cursor:pointer;color:var(--red);padding:0 0 0 4px">✕</button>
            </span>`).join('')
            : '<span class="tiny dim">ยังไม่ได้เลือก</span>')}
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <select id="pd-org-add" style="flex:1">
            <option value="">+ เพิ่มหน่วยงาน…</option>
            ${orgs.map((o) => `<option value="${o.id}">${e(o.name)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="margin-top:16px;border-top:1px solid var(--book-line);padding-top:14px">
        <label class="tiny dim">รหัสผ่านของผู้ปกครองคนนี้ (ใช้ตอนล็อกอิน)</label>
        <div class="pass-row" style="margin-top:6px">
          <input class="input" id="pd-pass" readonly data-real="${e(data.password || '')}"
            value="${data.password ? '••••••••' : '—'}">
          <button class="icon-btn" id="pd-eye" type="button" title="ดูรหัสผ่าน" aria-label="ดูรหัสผ่าน">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="icon-btn" id="pd-pencil" type="button" title="เปลี่ยนรหัสผ่าน" aria-label="เปลี่ยนรหัสผ่าน">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
          </button>
        </div>
        <div id="pd-change" style="display:none;margin-top:10px">
          <div class="field-row"><label>รหัสผ่านใหม่</label>
            <input id="pd-new1" type="password" placeholder="อย่างน้อย 6 ตัวอักษร" autocomplete="new-password"></div>
          <div class="field-row"><label>ยืนยันรหัสผ่านใหม่</label>
            <input id="pd-new2" type="password" placeholder="พิมพ์ซ้ำ" autocomplete="new-password"></div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" id="pd-cancel" style="flex:1">ยกเลิก</button>
            <button class="btn btn-primary btn-sm" id="pd-save" style="flex:1">บันทึก</button>
          </div>
        </div>
      </div>`,
    footer: `<button class="btn btn-danger" type="button" data-del>ลบบัญชีผู้ปกครอง</button>
             <button class="btn btn-ghost" type="button" data-modal-close>ปิด</button>`,
    onMount: (root) => {
      const pass = root.querySelector('#pd-pass');
      const dots = (v) => '•'.repeat(Math.max(6, Math.min(14, String(v || '').length || 8)));

      root.querySelector('#pd-eye')?.addEventListener('click', () => {
        const real = pass.dataset.real || '';
        if (!real) return;
        pass.value = pass.value.includes('•') ? real : dots(real);
      });
      root.querySelector('#pd-pencil')?.addEventListener('click', () => {
        const box = root.querySelector('#pd-change');
        box.style.display = box.style.display === 'none' ? '' : 'none';
      });
      root.querySelector('#pd-cancel')?.addEventListener('click', () => {
        root.querySelector('#pd-change').style.display = 'none';
        root.querySelector('#pd-new1').value = '';
        root.querySelector('#pd-new2').value = '';
      });
      root.querySelector('#pd-save')?.addEventListener('click', async () => {
        const p1 = root.querySelector('#pd-new1').value;
        const p2 = root.querySelector('#pd-new2').value;
        if (p1.length < 6) { toast('รหัสผ่านอย่างน้อย 6 ตัวอักษร', 'error'); return; }
        if (p1 !== p2) { toast('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'error'); return; }
        try {
          await ctx.data.setParentPassword(userId, p1);
          pass.dataset.real = p1;
          pass.value = dots(p1);
          root.querySelector('#pd-change').style.display = 'none';
          root.querySelector('#pd-new1').value = '';
          root.querySelector('#pd-new2').value = '';
          toast('เปลี่ยนรหัสผ่านแล้ว', 'success');
        } catch (err) { toast(err.message || 'ไม่สำเร็จ', 'error'); }
      });
      root.querySelectorAll('[data-unlink]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await ctx.data.unlinkStudent(btn.dataset.unlink);
            toast('ถอดนักเรียนออกแล้ว', 'success');
            closeModal();
            location.reload();
          } catch (err) { toast(err.message || 'ไม่สำเร็จ', 'error'); }
        });
      });
      root.querySelector('#pd-add-student')?.addEventListener('click', () => {
        closeModal();
        openAddStudent(userId, ctx);
      });

      root.querySelector('#pd-org-add')?.addEventListener('change', async (ev) => {
        const id = ev.currentTarget.value;
        if (!id) return;
        const next = [...new Set([...(data.org_ids || []), id])];
        try {
          await ctx.data.setParentOrgs(userId, next);
          data.org_ids = next;
          toast('เพิ่มหน่วยงานแล้ว', 'success');
          closeModal();
          openParentDetail(userId, ctx);
        } catch (err) { toast(err.message || 'ไม่สำเร็จ', 'error'); }
      });
      root.querySelectorAll('[data-drop-org]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const next = (data.org_ids || []).filter((x) => x !== btn.dataset.dropOrg);
          try {
            await ctx.data.setParentOrgs(userId, next);
            data.org_ids = next;
            toast('ลบหน่วยงานแล้ว', 'success');
            closeModal();
            openParentDetail(userId, ctx);
          } catch (err) { toast(err.message || 'ไม่สำเร็จ', 'error'); }
        });
      });

      root.querySelector('[data-del]')?.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'ลบบัญชีผู้ปกครอง',
          message: 'จะลบข้อมูลบัญชี คอร์สที่ซื้อ และการผูกนักเรียนทั้งหมดออกจาก Supabase — บัญชีนักเรียนไม่หาย แต่ผู้ปกครองต้องสมัครใหม่ถ้าจะกลับมาใช้',
          confirmLabel: 'ลบบัญชี', tone: 'danger',
        });
        if (!ok) return;
        try {
          await ctx.data.deleteParent(userId);
          toast('ลบบัญชีผู้ปกครองแล้ว', 'success');
          closeModal();
          location.reload();
        } catch (err) { toast(err.message || 'ลบไม่สำเร็จ', 'error'); }
      });
    },
  });
}
