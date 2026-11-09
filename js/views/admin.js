/* ── หลังบ้านเจ้าของระบบ ───────────────────────────────── */

import { closeModal, confirmDialog, openModal, toast } from '../ui.js';
import { openAddParentForStudent, openAddStudent, openParentDetail } from './students.js';
import { e, thaiDate, thaiDateTime } from '../utils.js';

export async function renderAdmin(_arg, ctx) {
  const role = ctx.me?.role || 'teacher';
  window.__bkRole = role;
  const fallbackTab = role === 'owner' ? 'orders' : 'parents';
  const tab = ctx.route?.query.get('tab') || fallbackTab;
  const editId = ctx.route?.query.get('edit') || '';

  const [orders, courses, accounts, links, roster, coupons, orgs, teachersMock, studentsOverviewData, classMap, categories] = await Promise.all([
    ctx.data.listAllOrders(),
    ctx.data.listCourses({ all: true }),
    ctx.data.listAccounts(),
    ctx.data.listAllLinks(),
    ctx.data.listMockRoster().catch(() => ({ students: [], organizations: [] })),
    ctx.data.listCoupons().catch(() => []),
    ctx.data.listOrganizations().catch(() => []),
    ctx.data.teachersList().catch(() => []),
    ctx.data.studentsOverview().catch(() => []),
    ctx.data.classNames().catch(() => ({})),
    ctx.data.listCategories().catch(() => []),
  ]);

  const parents = accounts.filter((a) => a.role === 'parent');
  const teachers = accounts.filter((a) => a.role === 'teacher');
  const pendingCount = orders.filter((o) => o.status === 'pending_confirm').length;
  const paid = orders.filter((o) => o.status === 'confirmed').reduce((s, o) => s + Number(o.amount || 0), 0);

  const items = buildMenu(tab, ctx.me?.role === 'owner').map((it) => ({
    ...it, count: it.id === 'orders' ? pendingCount || '' : '',
  }));

  ctx._roster = roster;
  window.__bkStudents = studentsOverviewData || [];
  window.__bkClassMap = classMap || {};

  const isOwner = ctx.me?.role === 'owner';

  const body = tab === 'orders'
    ? ordersHtml(orders, ctx)
    : tab === 'courses'
      ? coursesHtml(courses, editId, ctx, categories)
      : tab === 'coupons'
        ? couponsHtml(coupons, courses, editId, ctx)
        : tab === 'teachers'
          ? teachersHtml(teachersMock, ctx, orgs)
          : tab === 'parents' || tab === 'users' || tab === 'links'
            ? parentsHtml(scopeParents(parents, links, ctx), links, ctx, orgs)
            : tab === 'students'
              ? studentsHtml(studentsOverviewData, ctx, orgs, classMap)
              : settingsHtml(ctx);

  const isOwnerRole = ctx.me?.role === 'owner';
  const html = ctx.consoleLayout({
    items,
    title: isOwnerRole ? 'หลังบ้าน' : 'บุคลากรและนักเรียน',
    subtitle: isOwnerRole
      ? 'ยืนยันการชำระเงิน จัดการคอร์ส และผูกนักเรียนให้ผู้ปกครอง'
      : 'ดูและจัดการผู้ปกครอง/นักเรียนในหน่วยงานของคุณ',
    body: `
      <div class="stat-row">
        ${isOwnerRole ? `
          <div class="stat-card"><div class="k">รอยืนยัน</div><div class="v">${pendingCount}<small>รายการ</small></div></div>
          <div class="stat-card"><div class="k">ยืนยันแล้ว</div><div class="v">${orders.filter((o) => o.status === 'confirmed').length}<small>รายการ</small></div></div>
          <div class="stat-card"><div class="k">ยอดรับชำระ</div><div class="v">${ctx.baht(paid)}</div></div>` : ''}
        <div class="stat-card"><div class="k">ผู้ปกครอง</div><div class="v">${parents.length}<small>คน</small></div></div>
        <div class="stat-card"><div class="k">นักเรียน</div><div class="v">${studentsOverviewData.length}<small>คน</small></div></div>
        ${isOwnerRole ? `<div class="stat-card"><div class="k">โค้ดส่วนลดที่เปิด</div><div class="v">${coupons.filter((c) => c.active).length}<small>โค้ด</small></div></div>` : ''}
      </div>
      ${body}
    `,
  });

  setTimeout(() => bindAdmin(ctx, tab), 0);
  return html;
}


/** ครู (ไม่ใช่เจ้าของ) เห็นเฉพาะเมนูบุคลากรและนักเรียน */
function isOwnerView() {
  return (window.__bkRole || '') === 'owner';
}


/** เมนูหลังบ้านชุดเดียว ใช้ร่วมกันทุกหน้า (รวมหน้ารายละเอียดนักเรียน) */
export function buildMenu(activeTab, isOwner) {
  const items = [
    { id: 'orders', label: 'รอยืนยัน', icon: 'orders' },
    { id: 'courses', label: 'คอร์สเรียน', icon: 'courses' },
    { id: 'coupons', label: 'บัตรส่วนลด', icon: 'coupons' },
    { id: 'teachers', label: 'ครู', icon: 'teachers', group: 'people' },
    { id: 'parents', label: 'ผู้ปกครอง', icon: 'parents', group: 'people' },
    { id: 'students', label: 'นักเรียน', icon: 'students', group: 'people' },
    { id: 'settings', label: 'ตั้งค่า', icon: 'settings', group: 'config' },
  ];
  return items
    .filter((it) => isOwner || it.group === 'people')
    .map((it) => ({ ...it, href: `#/dashboard?tab=${it.id}`, active: activeTab === it.id }));
}

/* ── รอยืนยัน ─────────────────────────────────────────── */
function ordersHtml(orders, ctx) {
  const pending = orders.filter((o) => o.status === 'pending_confirm');
  const history = orders.filter((o) => o.status !== 'pending_confirm').slice(0, 30);
  return `
  <div class="book-card" style="margin-bottom:20px">
    <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:12px">สลิปรอตรวจ (${pending.length})</div>
    ${pending.length ? pending.map((o) => `
      <div class="slip-row" id="row-${o.id}">
        <div class="slip-row__thumb" data-slip-zoom="${o.id}" title="กดเพื่อดูรูปใหญ่">
          <img class="slip-thumb" src="" alt="สลิป" data-slip-img="${o.id}">
          <span class="slip-row__zoom">ดูรูปใหญ่</span>
        </div>

        <div class="slip-row__info">
          <button class="parent-link" data-open-parent="${o.user_id}">${e(o.parent?.name || o.parent?.email || 'ผู้ปกครอง')}</button>
          <div class="tiny dim">${e(o.parent?.phone || '—')}${o.parent?.line_id ? ` · ${e(o.parent.line_id)}` : ''}</div>
          <div style="margin-top:8px;font-family:var(--brand-font);font-size:15px">${e(o.course_title)}</div>
          <div class="tiny dim">ผู้เรียน ${e(o.student_name || '—')} · ${e(thaiDateTime(o.created_at))}</div>
          ${o.coupon_code ? `<div class="tiny dim">ใช้โค้ด ${e(o.coupon_title || o.coupon_code)} · ประหยัด ${ctx.baht(o.discount || 0)}</div>` : ''}
          <div class="price" style="margin-top:6px">${ctx.baht(o.amount)}</div>
        </div>

        <div class="slip-row__actions">
          <button class="btn btn-ghost btn-sm" data-download="${o.id}">ดาวน์โหลดสลิป</button>
          <button class="btn btn-primary btn-sm" data-confirm="${o.id}">ยืนยัน</button>
          <button class="btn btn-ghost btn-sm" data-reject="${o.id}" style="color:var(--red)">ไม่ผ่าน</button>
        </div>
      </div>`).join('')
      : `<p class="tiny dim">ยังไม่มีสลิปที่รอตรวจ</p>`}
  </div>

  <div class="book-card">
    <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:10px">ประวัติล่าสุด</div>
    <div class="table-wrap"><table class="book-table">
      <thead><tr><th>วันที่</th><th>ผู้ปกครอง</th><th>คอร์ส</th><th>ผู้เรียน</th><th>ยอด</th><th>สถานะ</th></tr></thead>
      <tbody>${history.map((o) => `<tr>
        <td class="tiny">${e(thaiDate(o.created_at))}</td>
        <td><button class="parent-link" data-open-parent="${o.user_id}">${e(o.parent?.name || '—')}</button>
          <div class="tiny dim">${e(o.parent?.email || '')}</div></td>
        <td>${e(o.course_title)}</td>
        <td>${e(o.student_name || '—')}</td>
        <td>${ctx.baht(o.amount)}</td>
        <td>${ctx.statusBadge(o.status)}</td>
      </tr>`).join('') || '<tr><td colspan="6" class="tiny dim">ยังไม่มีประวัติ</td></tr>'}</tbody>
    </table></div>
  </div>`;
}

/* ── คอร์ส + หมวดหมู่ ───────────────────────────────── */
function coursesHtml(courses, editId, ctx, categories = []) {
  const isOwner = ctx.me?.role === 'owner';
  const editing = courses.find((c) => c.id === editId);
  const newCatId = ctx.route?.query.get('new') === '1' ? (ctx.route?.query.get('cat') || '') : '';
  const open = Boolean(editing) || Boolean(newCatId);

  const grouped = categories.map((cat) => ({
    cat,
    items: courses.filter((c) => c.category_id === cat.id),
  }));
  const uncategorized = courses.filter((c) => !c.category_id || !categories.some((x) => x.id === c.category_id));

  const card = (c, catId) => `
    <div class="course-tile">
      <label class="course-tile__home" title="แสดงในหน้าแรกของ 02._.book">
        <input type="checkbox" data-home-toggle="${c.id}" ${c.show_on_home ? 'checked' : ''} ${isOwner ? '' : 'disabled'}>
      </label>
      <div class="course-tile__thumb">
        ${c.image_url
          ? `<img src="${e(c.image_url)}" alt="">`
          : `<span>${e((c.subject || 'คอร์ส').slice(0, 10))}</span>`}
      </div>
      <div class="course-tile__body">
        <div style="font-family:var(--brand-font);font-size:14.5px;line-height:1.3">${e(c.title)}</div>
        <div class="tiny dim">${ctx.baht(c.price)} · ${c.seats ? `${c.seats} ที่นั่ง` : 'ไม่จำกัดที่นั่ง'}${c.active ? '' : ' · ปิดขาย'}</div>
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          <a class="btn btn-ghost btn-sm" href="#/dashboard?tab=courses&edit=${c.id}">แก้ไข</a>
          <button class="btn btn-ghost btn-sm" data-move-course="${c.id}" data-dir="-1" title="เลื่อนขึ้น">↑</button>
          <button class="btn btn-ghost btn-sm" data-move-course="${c.id}" data-dir="1" title="เลื่อนลง">↓</button>
          <button class="btn btn-ghost btn-sm" data-del-course="${c.id}" style="color:var(--red)">ลบ</button>
        </div>
      </div>
    </div>`;

  const section = (cat, items) => `
    <div class="cat-bar">
      <div class="cat-bar__name">${e(cat ? cat.name : 'ยังไม่จัดหมวด')}</div>
      <div class="cat-bar__actions">
        ${cat && isOwner ? `
          <button class="btn btn-ghost btn-sm" data-move-cat="${cat.id}" data-dir="-1" title="เลื่อนหมวดขึ้น">↑</button>
          <button class="btn btn-ghost btn-sm" data-move-cat="${cat.id}" data-dir="1" title="เลื่อนหมวดลง">↓</button>
          <button class="btn btn-ghost btn-sm" data-edit-cat="${cat.id}" data-cat-name="${e(cat.name)}">เปลี่ยนชื่อ</button>
          <button class="btn btn-ghost btn-sm" data-del-cat="${cat.id}" style="color:var(--red)">ลบหมวด</button>` : ''}
        ${isOwner ? `<a class="btn btn-primary btn-sm" href="#/dashboard?tab=courses&new=1${cat ? `&cat=${cat.id}` : ''}">+ เพิ่มคอร์ส</a>` : ''}
      </div>
    </div>
    <div class="course-grid-admin">
      ${items.length ? items.map((c) => card(c, cat ? cat.id : '')).join('')
        : '<div class="empty-soft" style="padding:18px;grid-column:1/-1"><span class="tiny dim">ยังไม่มีคอร์สในหมวดนี้</span></div>'}
    </div>`;

  const list = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
      <div class="tiny dim">${categories.length} หมวด · ${courses.length} คอร์ส</div>
      ${isOwner ? '<button class="btn btn-primary btn-sm" id="add-category">+ เพิ่มหมวดหมู่</button>' : ''}
    </div>
    ${grouped.map((g) => section(g.cat, g.items)).join('')}
    ${uncategorized.length ? section(null, uncategorized) : ''}
    ${!courses.length && !categories.length ? `<div class="empty-soft"><b>ยังไม่มีคอร์ส</b>
      <p class="tiny dim" style="margin:0 0 10px">เริ่มจากกด "+ เพิ่มหมวดหมู่" ด้านบน</p></div>` : ''}`;

  if (!open) return list;

  const form = `
    <div class="book-card course-editor__form">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
        <div style="font-family:var(--brand-font);font-size:16px">${editing ? 'แก้ไขคอร์ส' : 'เพิ่มคอร์สใหม่'}</div>
        <a class="btn btn-ghost btn-sm" href="#/dashboard?tab=courses">ปิด</a>
      </div>
      <input type="hidden" id="c-id" value="${editing ? editing.id : ''}">
      <div class="field-row"><label>ชื่อคอร์ส</label><input id="c-title" value="${e(editing?.title || '')}"></div>
      <div class="field-row"><label>คำโปรยสั้น</label><input id="c-sub" value="${e(editing?.subtitle || '')}"></div>
      <div class="field-row"><label>รายละเอียด</label><textarea id="c-detail">${e(editing?.detail || '')}</textarea></div>
      <div class="field-row"><label>หมวดหมู่</label>
        <select id="c-cat">
          <option value="">— ไม่มีหมวด —</option>
          ${categories.map((cat) => `<option value="${cat.id}" ${
            (editing?.category_id === cat.id || (!editing && newCatId === cat.id)) ? 'selected' : ''}>${e(cat.name)}</option>`).join('')}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field-row"><label>ราคา (บาท)</label><input id="c-price" type="number" min="0" step="50" value="${Number(editing?.price || 0)}"></div>
        <div class="field-row"><label>ระดับชั้น</label><input id="c-level" value="${e(editing?.level || '')}" placeholder="ม.4–ม.6"></div>
      </div>
      <div class="field-row">
        <label>จำนวนที่นั่ง</label>
        <label class="check-line">
          <input type="checkbox" id="c-unlimited" ${!editing || !Number(editing?.seats) ? 'checked' : ''}>
          <span>ไม่จำกัดจำนวนคน</span>
        </label>
        <input id="c-seats" type="number" min="1" value="${Number(editing?.seats || 8)}"
          ${!editing || !Number(editing?.seats) ? 'disabled' : ''}>
      </div>
      <details style="margin:10px 0">
        <summary class="tiny dim" style="cursor:pointer">รายละเอียดเพิ่มเติม (ไม่บังคับ)</summary>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
          <div class="field-row"><label>ชั่วโมงเรียน</label><input id="c-hours" type="number" min="0" value="${Number(editing?.hours || 0)}"></div>
          <div class="field-row"><label>จำนวนครั้ง/ชุด</label><input id="c-lessons" type="number" min="0" value="${Number(editing?.lessons || 0)}"></div>
        </div>
      </details>
      <div class="field-row"><label>รูปปก (แนะนำ 1200×675 px)</label>
        <input type="file" id="c-img-file" accept="image/*">
        <div id="c-img-preview" style="margin-top:8px">
          ${editing?.image_url ? `<img src="${e(editing.image_url)}" class="coupon-img-preview" alt="">` : ''}
        </div>
      </div>
      <label class="check-line" style="margin-top:6px">
        <input type="checkbox" id="c-home" ${editing ? (editing.show_on_home ? 'checked' : '') : 'checked'}>
        <span>แสดงในหน้าแรกของ 02._.book</span>
      </label>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-primary" id="c-save">${editing ? 'บันทึกการแก้ไข' : 'บันทึกคอร์ส'}</button>
        <a class="btn btn-ghost" href="#/dashboard?tab=courses">ยกเลิก</a>
      </div>
    </div>`;

  const previewData = editing || {
    title: 'ชื่อคอร์ส', subtitle: 'คำโปรยสั้น', price: 0, seats: 0, level: '', image_url: '',
  };
  const preview = `
    <div class="course-editor__preview">
      <div class="tiny dim" style="margin-bottom:8px">ตัวอย่างที่ผู้ปกครองเห็น</div>
      ${ctx.courseCardForAdmin({ ...previewData, left: previewData.seats ? previewData.seats : null })}
      <div style="margin-top:12px"><a class="btn btn-ghost btn-sm" href="#/dashboard?tab=courses">← กลับรายการคอร์ส</a></div>
    </div>`;

  return `<div class="course-editor">${preview}${form}</div>`;
}

/* ── บัตรส่วนลด ───────────────────────────────────────── */
function couponsHtml(coupons, courses, editId, ctx) {
  const isOwner = ctx.me?.role === 'owner';
  const editing = coupons.find((c) => c.id === editId);
  const open = Boolean(editing) || ctx.route?.query.get('new') === '1';
  const courseName = (id) => courses.find((c) => c.id === id)?.title || '—';
  const scopeText = (c) => ((c.course_ids || []).length ? c.course_ids.map(courseName).join(' · ') : 'ทุกคอร์ส');
  const valueText = (c) => (c.kind === 'percent' ? `ลด ${c.value}%` : `ลด ${ctx.baht(c.value)}`);

  const list = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      <div class="tiny dim">ทั้งหมด ${coupons.length} โค้ด</div>
      ${isOwner ? '<a class="btn btn-primary btn-sm" href="#/dashboard?tab=coupons&new=1">+ เพิ่มคูปอง</a>' : ''}
    </div>
    <div class="book-card">
      ${coupons.length ? `<div class="table-wrap"><table class="book-table coupon-table">
        <thead><tr><th>โค้ด</th><th>ส่วนลด</th><th>ใช้กับ</th><th>ใช้แล้ว</th><th>สถานะ</th><th></th></tr></thead>
        <tbody>${coupons.map((c) => `<tr>
          <td>
            ${c.image_url ? `<img src="${e(c.image_url)}" alt="" class="coupon-thumb">` : ''}
            <b>${e(c.title || c.code)}</b>
            <div class="tiny dim">${e(c.code)}${c.note ? ` · ${e(c.note)}` : ''}</div>
          </td>
          <td>${e(valueText(c))}</td>
          <td class="tiny">${e(scopeText(c))}</td>
          <td class="num">${c.used || 0}${c.max_uses ? ` / ${c.max_uses}` : ''}</td>
          <td>${c.active ? '<span class="chip chip--ok">เปิด</span>' : '<span class="chip chip--mute">ปิด</span>'}</td>
          <td style="white-space:nowrap">
            <a class="btn btn-ghost btn-sm" href="#/dashboard?tab=coupons&edit=${c.id}">แก้ไข</a>
            <button class="btn btn-ghost btn-sm" data-del-coupon="${c.id}" style="color:var(--red)">ลบ</button>
          </td>
        </tr>`).join('')}</tbody>
      </table></div>` : `<p class="tiny dim">ยังไม่มีคูปอง — กด "+ เพิ่มคูปอง" เพื่อสร้างใบแรก</p>`}
    </div>`;

  if (!open) return list;

  const kind = editing?.kind === 'amount' ? 'amount' : 'percent';
  const limited = editing ? Number(editing.max_uses) > 0 : true;
  const maxUses = editing && Number(editing.max_uses) > 0 ? Number(editing.max_uses) : 1;

  const form = `
    <div class="book-card course-editor__form">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
        <div style="font-family:var(--brand-font);font-size:16px">${editing ? 'แก้ไขคูปอง' : 'เพิ่มคูปอง'}</div>
        <a class="btn btn-ghost btn-sm" href="#/dashboard?tab=coupons">ปิด</a>
      </div>
      <input type="hidden" id="cp-id" value="${editing ? editing.id : ''}">

      <div class="field-row"><label>ชื่อคูปอง (แสดงให้ผู้ปกครองเห็น)</label>
        <input id="cp-title" value="${e(editing?.title || '')}" placeholder="เช่น บัตรส่วนลดเปิดเทอม" maxlength="80"></div>

      <div class="field-row"><label>โค้ด (ตัวอักษร/ตัวเลข)</label>
        <div style="display:flex;gap:8px">
          <input id="cp-code" value="${e(editing?.code || '')}" placeholder="MATH100" style="text-transform:uppercase">
          <button class="btn btn-ghost btn-sm" id="cp-rand" type="button">สุ่มโค้ด</button>
        </div>
      </div>

      <div class="field-row">
        <label>ส่วนลด</label>
        <div class="unit-row">
          <label class="check-line" style="margin:0">
            <input type="checkbox" id="cp-is-percent" ${kind === 'percent' ? 'checked' : ''}>
            <span>เปอร์เซ็นต์</span>
          </label>
          <input id="cp-value" type="number" min="0" value="${Number(editing?.value || 0)}" style="flex:1">
          <span class="unit-suffix" id="cp-unit">${kind === 'percent' ? '%' : 'บาท'}</span>
        </div>
      </div>

      <div class="field-row"><label>ยอดขั้นต่ำ (บาท)</label>
        <input id="cp-min" type="number" min="0" value="${Number(editing?.min_amount || 0)}"></div>

      <div class="field-row">
        <label>จำนวนครั้งที่ใช้ได้</label>
        <label class="check-line" style="margin:0">
          <input type="checkbox" id="cp-limited" ${limited ? 'checked' : ''}>
          <span>จำกัดจำนวนครั้ง</span>
        </label>
        <input id="cp-max" type="number" min="1" value="${maxUses}" ${limited ? '' : 'disabled'}>
      </div>

      <div class="field-row">
        <label>ใช้กับคอร์ส (ไม่เลือกเลย = ใช้ได้ทุกคอร์ส)</label>
        <select id="cp-courses" multiple size="${Math.min(6, Math.max(3, courses.length))}" style="height:auto">
          ${courses.map((c) => `<option value="${c.id}" ${(editing?.course_ids || []).includes(c.id) ? 'selected' : ''}>${e(c.title)}</option>`).join('')}
        </select>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button class="btn btn-ghost btn-sm" type="button" id="cp-clear-courses">ล้างการเลือก (ใช้ทุกคอร์ส)</button>
          <span class="hint" style="align-self:center">กด Ctrl/⌘ ค้างเพื่อเลือกหลายคอร์ส</span>
        </div>
      </div>

      <div class="field-row"><label>รูปบัตร (แนวนอน แนะนำ 1000×560 px · ไม่เกิน 1MB)</label>
        <input type="file" id="cp-image" accept="image/*">
        <div id="cp-img-preview" style="margin-top:8px">
          ${editing?.image_url ? `<img src="${e(editing.image_url)}" alt="" class="coupon-img-preview">` : ''}
        </div>
        ${editing?.image_url ? '<button class="btn btn-ghost btn-sm" type="button" id="cp-img-remove" style="margin-top:6px">ลบรูปบัตร</button>' : ''}
      </div>

      <div class="field-row"><label>หมายเหตุ</label>
        <input id="cp-note" value="${e(editing?.note || '')}" placeholder="เช่น โปรเปิดเทอม"></div>

      <div class="field-row"><label>วันหมดอายุ (ไม่บังคับ)</label>
        <input id="cp-exp" type="date" value="${editing?.expires_at ? String(editing.expires_at).slice(0, 10) : ''}"></div>

      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-primary" id="cp-save">${editing ? 'บันทึกการแก้ไข' : 'สร้างคูปอง'}</button>
        <a class="btn btn-ghost" href="#/dashboard?tab=coupons">ยกเลิก</a>
      </div>
    </div>`;

  const preview = `
    <div class="course-editor__preview">
      <div class="tiny dim" style="margin-bottom:8px">ตัวอย่างที่ผู้ปกครองเห็น</div>
      ${ctx.couponCardForAdmin(editing || { kind: 'percent', value: 10, title: '', code: 'CODE', course_ids: [] }, courses)}
      <div style="margin-top:12px"><a class="btn btn-ghost btn-sm" href="#/dashboard?tab=coupons">← กลับรายการคูปอง</a></div>
    </div>`;

  return `<div class="course-editor">${preview}${form}</div>`;
}

/* ── ครู (จาก 02._.mock) ─────────────────────────────── */
function teachersHtml(teachers, ctx, orgs) {
  const orgFilter = ctx.route?.query.get('torg') || '';
  const orgName = (id) => orgs.find((o) => o.id === id)?.name || id || '';
  const shown = orgFilter ? teachers.filter((t) => t.orgId === orgFilter) : teachers;

  return `
  <div class="filter-bar">
    <span class="filter-bar__icon">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18l-7 8v6l-4 2v-8z"/></svg>
    </span>
    <select id="teacher-org" class="filter-select">
      <option value="">ครูทั้งหมด (${teachers.length})</option>
      ${orgs.map((o) => `<option value="${o.id}" ${orgFilter === o.id ? 'selected' : ''}>${e(o.name)}</option>`).join('')}
    </select>
  </div>

  ${shown.length ? `<div class="book-card" style="padding:8px 10px">
    ${shown.map((t) => `
      <div class="pair-row">
        <button class="pair-row__left" data-open-teacher="${e(t.code)}">
          <span class="pair-row__avatar">${e((t.name || '?').trim().charAt(0))}</span>
          <span class="pair-row__text">
            <b style="font-size:16px">${e(t.name || '—')}${t.isOwner ? ' <span class="chip chip--ok">เจ้าของระบบ</span>' : ''}</b>
            <span class="tiny dim">${e(t.orgName || orgName(t.orgId) || 'ไม่ระบุหน่วยงาน')}</span>
          </span>
        </button>
        <div class="pair-row__right">
          <span class="tiny dim">กดที่ชื่อเพื่อดูข้อมูลติดต่อ</span>
        </div>
      </div>`).join('')}
  </div>` : `<div class="empty-soft"><b>ไม่พบครู</b><p class="tiny dim" style="margin:0">ลองเลือกโรงเรียน/หน่วยงานอื่น</p></div>`}`;
}


/* ── รายละเอียดครู ───────────────────────────────────── */
async function openTeacherDetail(code, ctx) {
  let d;
  try { d = await ctx.data.teacherDetail(code); } catch (err) {
    toast(err.message || 'โหลดข้อมูลครูไม่สำเร็จ', 'error');
    return;
  }
  if (!d) { toast('ไม่พบข้อมูลครูคนนี้', 'error'); return; }

  openModal({
    title: d.name || code,
    size: 'sm',
    body: `
      <div class="kv"><span>รหัสครู</span><b>${e(d.code)}</b></div>
      <div class="kv"><span>โรงเรียน / หน่วยงาน</span><b>${e(d.orgName || d.school || '—')}</b></div>
      ${d.subject ? `<div class="kv"><span>กลุ่มสาระ</span><b>${e(d.subject)}</b></div>` : ''}
      <div class="kv"><span>เบอร์โทร (ที่ให้ไว้)</span><b>${e(d.phone || d.mockPhone || '—')}</b></div>
      <div class="kv"><span>LINE ID</span><b>${e(d.lineId || '—')}</b></div>
      ${d.isOwner ? '<div class="kv"><span>สิทธิ์</span><b>เจ้าของระบบ — เห็นทุกหน่วยงาน</b></div>' : ''}

      <div style="margin-top:14px;border-top:1px solid var(--book-line);padding-top:12px">
        <div class="tiny dim" style="margin-bottom:6px">หน่วยงาน/โรงเรียนที่มองเห็น</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${(d.orgs || []).length
            ? (d.orgs || []).map((o) => `<span class="chip chip--mute">${e(o.name)}</span>`).join('')
            : '<span class="tiny dim">—</span>'}
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:14px">
        <div class="stat-card" style="flex:1;padding:12px 14px"><div class="k">ผู้ปกครองที่ดูแล</div><div class="v" style="font-size:20px">${d.parents ?? 0}</div></div>
        <div class="stat-card" style="flex:1;padding:12px 14px"><div class="k">นักเรียน</div><div class="v" style="font-size:20px">${d.students ?? 0}</div></div>
      </div>`,
    footer: `<button class="btn btn-ghost" type="button" data-modal-close>ปิด</button>`,
  });
}

/* ── ผู้ปกครอง ───────────────────────────────────────── */
function parentsHtml(parents, links, ctx, orgs) {
  const orgFilter = ctx.route?.query.get('porg') || '';
  const orgName = (id) => orgs.find((o) => o.id === id)?.name || id || '';
  const byParent = {};
  links.forEach((l) => { (byParent[l.user_id] = byParent[l.user_id] || []).push(l); });

  const shown = orgFilter
    ? parents.filter((p) => (p.org_ids || []).includes(orgFilter)
        || (byParent[p.user_id] || []).some((l) => l.org_id === orgFilter))
    : parents;

  return `
  <div class="filter-bar">
    <span class="filter-bar__icon">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18l-7 8v6l-4 2v-8z"/></svg>
    </span>
    <select id="parent-org" class="filter-select">
      <option value="">ผู้ปกครองทั้งหมด (${parents.length})</option>
      ${orgs.map((o) => `<option value="${o.id}" ${orgFilter === o.id ? 'selected' : ''}>${e(o.name)}</option>`).join('')}
    </select>
  </div>

  ${shown.length ? `<div class="book-card" style="padding:8px 10px">
    ${shown.map((p) => `
      <div class="pair-row">
        <button class="pair-row__left" data-open-parent="${p.user_id}">
          <span class="pair-row__avatar">${e((p.name || p.email || '?').trim().charAt(0))}</span>
          <span class="pair-row__text">
            <b>${e(p.name || p.email || 'ผู้ปกครอง')}</b>
            <span class="tiny dim">${e(p.phone || '—')}${p.line_id ? ` · ${e(p.line_id)}` : ''}</span>
          </span>
        </button>
        <div class="pair-row__right">
          ${(byParent[p.user_id] || []).length
            ? (byParent[p.user_id] || []).map((l) => `
                <span class="chip chip--mute">${e(l.student_name || l.student_id)}${l.org_id ? ` · ${e(orgName(l.org_id))}` : ''}</span>`).join('')
            : `<button class="btn btn-primary btn-sm" data-add-student="${p.user_id}">+ เพิ่มบัญชีนักเรียน</button>`}
          <button class="add-plus" data-add-student="${p.user_id}" title="เพิ่มบัญชีนักเรียน" aria-label="เพิ่มบัญชีนักเรียน">+</button>
        </div>
      </div>`).join('')}
  </div>` : `<div class="empty-soft"><b>ไม่พบผู้ปกครอง</b><p class="tiny dim" style="margin:0">ลองเลือกโรงเรียน/หน่วยงานอื่น</p></div>`}`;
}

/* ── นักเรียน ────────────────────────────────────────── */
function studentsHtml(students, ctx, orgs, classMap = {}) {
  const orgFilter = ctx.route?.query.get('sorg') || '';
  const classFilter = ctx.route?.query.get('sclass') || '';
  const orgName = (id) => orgs.find((o) => o.id === id)?.name || id || '';
  const className = (id) => classMap[id] || '';

  // รายการ class ที่มีจริงในหน่วยงานที่เลือก: id → ชื่อ
  const inOrg = orgFilter ? students.filter((s) => s.orgId === orgFilter) : students;
  const classOptions = new Map();
  inOrg.forEach((s) => {
    (s.classIds || []).forEach((id) => {
      const nm = s.classId === id ? (s.class || className(id)) : className(id);
      if (nm && !classOptions.has(id)) classOptions.set(id, nm);
    });
  });
  if (!classOptions.size) inOrg.forEach((s) => { if (s.class) classOptions.set(s.class, s.class); });

  const shown = inOrg.filter((s) => !classFilter || (s.classIds || []).includes(classFilter) || s.class === classFilter);
  const pickedClass = classFilter ? (classOptions.get(classFilter) || className(classFilter) || classFilter) : '';
  const label = [orgFilter ? orgName(orgFilter) : 'ทุกโรงเรียน/หน่วยงาน', pickedClass || 'ทุก class'].join(' | ');

  return `
  <div class="filter-bar">
    <span class="filter-bar__icon">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h18l-7 8v6l-4 2v-8z"/></svg>
    </span>
    <select id="student-org" class="filter-select">
      <option value="">ทุกโรงเรียน/หน่วยงาน (${students.length})</option>
      ${orgs.map((o) => `<option value="${o.id}" ${orgFilter === o.id ? 'selected' : ''}>${e(o.name)}</option>`).join('')}
    </select>
    <select id="student-class" class="filter-select" ${orgFilter ? '' : 'disabled title="เลือกโรงเรียน/หน่วยงานก่อน"'}>
      <option value="">ทุก class${orgFilter ? ` · ${inOrg.length} คน` : ''}</option>
      ${[...classOptions.entries()].map(([id, nm]) => `<option value="${e(id)}" ${classFilter === id ? 'selected' : ''}>${e(nm)}</option>`).join('')}
    </select>
    <span class="filter-bar__label">${e(label)}</span>
  </div>

  ${shown.length ? `<div class="book-card" style="padding:8px 10px">
    ${shown.map((st) => `
      <div class="pair-row" data-row-org="${e(st.orgId || '')}" data-row-class="${e((st.classIds || []).join(','))}">
        <a class="pair-row__left" href="#/students/${encodeURIComponent(st.id)}">
          <span class="pair-row__avatar">${e((st.name || '?').trim().charAt(0))}</span>
          <span class="pair-row__text">
            <b>${e(st.name || st.id)}</b>
            <span class="tiny dim">${e(st.code || '')} · ${e(orgName(st.orgId))}${st.class ? ` · ${e(st.class)}` : ''}</span>
          </span>
        </a>
        <div class="pair-row__right">
          ${(st.parents || []).length
            ? (st.parents || []).map((p) => `<button class="chip chip--mute" data-open-parent="${p.user_id}">${e(p.name || p.email)}</button>`).join('')
            : '<span class="tiny dim">ยังไม่มีผู้ปกครอง</span>'}
          <button class="add-plus" data-add-parent-to="${st.id}" title="เพิ่มผู้ปกครอง" aria-label="เพิ่มผู้ปกครอง">+</button>
        </div>
      </div>`).join('')}
  </div>` : `<div class="empty-soft"><b>ไม่พบนักเรียน</b><p class="tiny dim" style="margin:0">ลองเลือกโรงเรียน/หน่วยงานอื่น</p></div>`}`;
}

/* ── ตั้งค่า ─────────────────────────────────────────── */
function settingsHtml(ctx) {
  const s = ctx.settings || {};
  return `
  <div class="book-card" style="max-width:620px">
    <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:10px">ตั้งค่าการรับเงิน</div>
    <div class="field-row"><label>ประเภทพร้อมเพย์</label>
      <select id="s-type">
        <option value="phone" ${s.promptpay_type === 'phone' ? 'selected' : ''}>เบอร์โทร</option>
        <option value="national_id" ${s.promptpay_type === 'national_id' ? 'selected' : ''}>เลขบัตรประชาชน</option>
        <option value="ewallet" ${s.promptpay_type === 'ewallet' ? 'selected' : ''}>e-Wallet</option>
      </select></div>
    <div class="field-row"><label>เลขพร้อมเพย์</label><input id="s-id" value="${e(s.promptpay_id || '')}" placeholder="0617806696"></div>
    <div class="field-row"><label>ชื่อบัญชี</label><input id="s-name" value="${e(s.promptpay_name || '')}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="field-row"><label>Line ที่ให้ติดต่อ</label><input id="s-line" value="${e(s.contact_line || '')}"></div>
      <div class="field-row"><label>เบอร์โทรติดต่อ</label><input id="s-phone" value="${e(s.contact_phone || '')}"></div>
    </div>
    <button class="btn btn-primary" id="s-save">บันทึกการตั้งค่า</button>
  </div>`;
}

/* ── events ──────────────────────────────────────────── */

/** ผูกตัวกรอง (หน่วยงาน/class) + ปุ่ม + ในรายการ — กันผูกซ้ำ */
function bindListControls(root, ctx) {
  const go = (hash) => { location.hash = hash; window.dispatchEvent(new HashChangeEvent('hashchange')); };

  const orgSel = root.querySelector('#student-org');
  if (orgSel && !orgSel.dataset.bound) {
    orgSel.dataset.bound = '1';
    orgSel.addEventListener('change', (ev) => {
      const org = ev.currentTarget.value;
      const cls = root.querySelector('#student-class');
      if (cls) {
        cls.value = '';
        cls.disabled = !org;
        // เติม class ที่มีในโรงเรียนนั้นทันที (ไม่ต้องรอโหลดหน้าใหม่)
        const byOrg = (window.__bkStudents || []).filter((st) => st.orgId === org);
        const map = new Map();
        byOrg.forEach((st) => (st.classIds || []).forEach((id) => {
          const nm = st.classId === id ? (st.class || '') : ((window.__bkClassMap || {})[id] || '');
          if (nm && !map.has(id)) map.set(id, nm);
        }));
        if (!map.size) byOrg.forEach((st) => { if (st.class) map.set(st.class, st.class); });
        cls.innerHTML = `<option value="">ทุก class · ${byOrg.length} คน</option>`
          + [...map.entries()].map(([id, nm]) => `<option value="${id}">${nm}</option>`).join('');

        const labelEl2 = root.querySelector('.filter-bar__label');
        if (labelEl2) labelEl2.textContent = `${ev.currentTarget.selectedOptions[0]?.text || ''} | ทุก class`;

        // กรองรายการทันทีโดยไม่ต้องโหลดหน้าใหม่
        const rows = root.querySelectorAll('.pair-row');
        rows.forEach((row, i) => {
          const st = byOrg[i];
          row.style.display = st ? '' : 'none';
        });
        const listBox = root.querySelector('.book-card');
        const empty = root.querySelector('.filter-bar + .book-card');
        if (empty) empty.dataset.filtered = '1';
      }
      const labelEl = root.querySelector('.filter-bar__label');
      if (labelEl) labelEl.textContent = `${ev.currentTarget.selectedOptions[0]?.text || ''} | ทุก class`;
      go(`#/dashboard?tab=students&sorg=${encodeURIComponent(org)}`);
    });
  }

  const clsSel = root.querySelector('#student-class');
  if (clsSel && !clsSel.dataset.bound) {
    clsSel.dataset.bound = '1';
    clsSel.addEventListener('change', (ev) => {
      const org = root.querySelector('#student-org')?.value || '';
      const labelEl = root.querySelector('.filter-bar__label');
      if (labelEl) {
        labelEl.textContent = `${root.querySelector('#student-org')?.selectedOptions[0]?.text || ''} | ${ev.currentTarget.selectedOptions[0]?.text || ''}`;
      }
      go(`#/dashboard?tab=students&sorg=${encodeURIComponent(org)}&sclass=${encodeURIComponent(ev.currentTarget.value)}`);
    });
  }

  const parentSel = root.querySelector('#parent-org');
  if (parentSel && !parentSel.dataset.bound) {
    parentSel.dataset.bound = '1';
    parentSel.addEventListener('change', (ev) => go(`#/dashboard?tab=parents&porg=${encodeURIComponent(ev.currentTarget.value)}`));
  }

  const teacherSel = root.querySelector('#teacher-org');
  if (teacherSel && !teacherSel.dataset.bound) {
    teacherSel.dataset.bound = '1';
    teacherSel.addEventListener('change', (ev) => go(`#/dashboard?tab=teachers&torg=${encodeURIComponent(ev.currentTarget.value)}`));
  }

  root.querySelectorAll('[data-open-parent]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => openParentDetail(btn.dataset.openParent, ctx));
  });

  root.querySelectorAll('[data-open-teacher]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => openTeacherDetail(btn.dataset.openTeacher, ctx));
  });

  root.querySelectorAll('[data-add-student]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => openAddStudent(btn.dataset.addStudent, ctx));
  });

  // ── หมวดหมู่คอร์ส ──────────────────────────────────────
  const addCat = root.querySelector('#add-category');
  if (addCat && !addCat.dataset.bound) {
    addCat.dataset.bound = '1';
    addCat.addEventListener('click', () => openCategoryDialog(ctx));
  }
  root.querySelectorAll('[data-edit-cat]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => openCategoryDialog(ctx, { id: btn.dataset.editCat, name: btn.dataset.catName || '' }));
  });
  root.querySelectorAll('[data-del-cat]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'ลบหมวดหมู่',
        message: 'คอร์สในหมวดนี้จะยังอยู่ แต่จะกลายเป็น "ยังไม่จัดหมวด" — ยืนยันลบ?',
        confirmLabel: 'ลบหมวด', tone: 'danger',
      });
      if (!ok) return;
      try {
        await ctx.data.deleteCategory(btn.dataset.delCat);
        toast('ลบหมวดหมู่แล้ว', 'success');
        location.reload();
      } catch (err) { toast(err.message || 'ลบไม่สำเร็จ', 'error'); }
    });
  });
  root.querySelectorAll('[data-move-cat]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      try { await ctx.data.moveCategory(btn.dataset.moveCat, Number(btn.dataset.dir)); location.reload(); }
      catch (err) { toast(err.message || 'สลับลำดับไม่สำเร็จ', 'error'); }
    });
  });
  root.querySelectorAll('[data-move-course]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      try { await ctx.data.moveCourse(btn.dataset.moveCourse, Number(btn.dataset.dir)); location.reload(); }
      catch (err) { toast(err.message || 'สลับลำดับไม่สำเร็จ', 'error'); }
    });
  });
  root.querySelectorAll('[data-home-toggle]').forEach((box) => {
    if (box.dataset.bound) return;
    box.dataset.bound = '1';
    box.addEventListener('change', async () => {
      try {
        await ctx.data.setCourseHome(box.dataset.homeToggle, box.checked);
        toast(box.checked ? 'แสดงในหน้าแรกแล้ว' : 'ซ่อนจากหน้าแรกแล้ว', 'success');
      } catch (err) { box.checked = !box.checked; toast(err.message || 'บันทึกไม่สำเร็จ', 'error'); }
    });
  });

  ctx._courses = (ctx._courses || []);
  bindCouponForm(root, ctx);

  root.querySelector('#cp-rand')?.addEventListener('click', () => {
    const input = root.querySelector('#cp-code');
    if (!input) return;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    input.value = Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  root.querySelector('#cp-clear-courses')?.addEventListener('click', () => {
    root.querySelectorAll('#cp-courses option').forEach((o) => { o.selected = false; });
    root.querySelector('#cp-courses')?.dispatchEvent(new Event('change', { bubbles: true }));
  });
  root.querySelector('#cp-image')?.addEventListener('change', async (ev) => {
    const file = ev.currentTarget.files?.[0];
    if (!file) return;
    try {
      const url = await ctx.data.uploadCouponImage(file);
      const box = root.querySelector('#cp-img-preview');
      if (box) box.innerHTML = `<img src="${url}" alt="" class="coupon-img-preview">`;
      toast('อัปโหลดรูปบัตรแล้ว', 'success');
    } catch (err) { toast(err.message || 'อัปโหลดไม่สำเร็จ', 'error'); }
  });
  root.querySelector('#cp-img-remove')?.addEventListener('click', () => {
    const box = root.querySelector('#cp-img-preview');
    if (box) box.innerHTML = '';
    toast('ลบรูปบัตรแล้ว', 'success');
  });

  root.querySelectorAll('[data-add-parent-to]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => openAddParentForStudent(btn.dataset.addParentTo, ctx));
  });
}


/** หน้าต่างเพิ่ม/เปลี่ยนชื่อหมวดหมู่ */
function openCategoryDialog(ctx, { id = '', name = '' } = {}) {
  openModal({
    title: id ? 'เปลี่ยนชื่อหมวดหมู่' : 'เพิ่มหมวดหมู่',
    size: 'sm',
    body: `<div class="field-row"><label>ชื่อหมวดหมู่</label>
      <input id="cat-name" value="${e(name)}" maxlength="80" placeholder="เช่น คอร์สคณิต ม.ปลาย"></div>`,
    footer: `<button class="btn btn-ghost" type="button" data-cancel-cat>ยกเลิก</button>
             <button class="btn btn-primary" type="button" data-save-cat>บันทึก</button>`,
    onMount: (root) => {
      const input = root.querySelector('#cat-name');
      setTimeout(() => input?.focus(), 40);
      const save = async () => {
        try {
          await ctx.data.saveCategory({ id: id || undefined, name: input.value });
          toast(id ? 'เปลี่ยนชื่อหมวดหมู่แล้ว' : 'เพิ่มหมวดหมู่แล้ว', 'success');
          closeModal();
          location.reload();
        } catch (err) { toast(err.message || 'บันทึกไม่สำเร็จ', 'error'); }
      };
      root.querySelector('[data-save-cat]')?.addEventListener('click', save);
      input?.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') save(); });
      root.querySelector('[data-cancel-cat]')?.addEventListener('click', closeModal);
    },
  });
}


/** ผูกพฤติกรรมฟอร์มคูปอง: หน่วย %, จำกัด/ไม่จำกัดครั้ง, พรีวิวสด */
function bindCouponForm(root, ctx) {
  const form = root.querySelector('#cp-save')?.closest('.book-card');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = '1';

  const isPercent = form.querySelector('#cp-is-percent');
  const unit = form.querySelector('#cp-unit');
  const value = form.querySelector('#cp-value');
  const limited = form.querySelector('#cp-limited');
  const max = form.querySelector('#cp-max');
  const coursesSel = form.querySelector('#cp-courses');
  const title = form.querySelector('#cp-title');
  const code = form.querySelector('#cp-code');
  const previewBox = root.querySelector('.course-editor__preview');

  const syncUnit = () => { if (unit) unit.textContent = isPercent?.checked ? '%' : 'บาท'; };
  const syncLimited = () => {
    if (!max || !limited) return;
    max.disabled = !limited.checked;
    if (!limited.checked) max.value = '';
    else if (!max.value) max.value = '1';
  };
  const syncPreview = () => {
    if (!previewBox || !ctx.couponCardForAdmin) return;
    const courseIds = [...(coursesSel?.selectedOptions || [])].map((o) => o.value);
    const draft = {
      kind: isPercent?.checked ? 'percent' : 'amount',
      value: Number(value?.value || 0),
      title: title?.value || '',
      code: (code?.value || '').toUpperCase() || 'CODE',
      course_ids: courseIds,
      min_amount: 0,
    };
    const old = previewBox.querySelector('.coupon-card');
    const html = ctx.couponCardForAdmin(draft, ctx._courses || []);
    if (old) { const tmp = document.createElement('div'); tmp.innerHTML = html; old.replaceWith(tmp.firstElementChild); }
  };

  isPercent?.addEventListener('change', () => { syncUnit(); syncPreview(); });
  limited?.addEventListener('change', () => { syncLimited(); });
  value?.addEventListener('input', syncPreview);
  title?.addEventListener('input', syncPreview);
  code?.addEventListener('input', syncPreview);
  coursesSel?.addEventListener('change', syncPreview);
  syncUnit(); syncLimited();

  // บันทึก
  form.querySelector('#cp-save')?.addEventListener('click', async () => {
    const courseIds = [...(coursesSel?.selectedOptions || [])].map((o) => o.value);
    const payload = {
      id: form.querySelector('#cp-id')?.value || undefined,
      title: title?.value.trim() || '',
      code: (code?.value || '').trim().toUpperCase(),
      kind: isPercent?.checked ? 'percent' : 'amount',
      value: Number(value?.value || 0),
      min_amount: Number(form.querySelector('#cp-min')?.value || 0),
      max_uses: limited?.checked ? Math.max(1, Number(max?.value || 1)) : 0,
      course_ids: courseIds,
      note: form.querySelector('#cp-note')?.value.trim() || '',
      expires_at: form.querySelector('#cp-exp')?.value || null,
      image_url: form.querySelector('#cp-img-preview img')?.getAttribute('src') || '',
    };
    if (!payload.code) { toast('กรุณากรอกโค้ด', 'error'); return; }
    if (payload.value <= 0) { toast('กรุณากรอกมูลค่าส่วนลด', 'error'); return; }
    try {
      await ctx.data.saveCoupon(payload);
      toast(payload.id ? 'บันทึกการแก้ไขแล้ว' : 'สร้างคูปองแล้ว', 'success');
      location.hash = '#/dashboard?tab=coupons';
      location.reload();
    } catch (err) { toast(err.message || 'บันทึกไม่สำเร็จ', 'error'); }
  });
}

function bindAdmin(ctx, tab) {
  const root = document.getElementById('app');
  bindListControls(root, ctx);

  root.querySelectorAll('[data-confirm]').forEach((btn) => {
    if (btn.closest('[data-preview]')) return;
    btn.addEventListener('click', async () => {
      const id = btn.dataset.confirm;
      const ok = await confirmDialog({
        title: 'ยืนยันการชำระเงิน',
        message: 'เมื่อยืนยันแล้ว สลิปจะถูกลบออกจาก Supabase ทันที (ดาวน์โหลดเก็บไว้ก่อนได้) — ยืนยันหรือไม่?',
        confirmLabel: 'ยืนยัน',
      });
      if (!ok) return;
      btn.disabled = true;
      try {
        await ctx.data.confirmOrder(id);
        toast('ยืนยันแล้ว และลบสลิปออกจาก Storage', 'success');
        location.reload();
      } catch (err) {
        btn.disabled = false;
        toast(err.message || 'ยืนยันไม่สำเร็จ', 'error');
      }
    });
  });

  root.querySelectorAll('[data-download]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.download;
      try {
        const order = (await ctx.data.listAllOrders()).find((o) => o.id === id);
        await ctx.data.downloadSlip(id, order?.slip_path || '');
        toast('ดาวน์โหลดสลิปแล้ว', 'success');
      } catch (err) {
        toast(err.message || 'ดาวน์โหลดไม่สำเร็จ', 'error');
      }
    });
  });

  root.querySelectorAll('[data-reject]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'ไม่ผ่านการชำระเงิน',
        message: 'สลิปจะถูกลบออกจาก Supabase และผู้ปกครองจะเห็นสถานะ "ไม่ผ่าน" — ยืนยันหรือไม่?',
        confirmLabel: 'ยืนยัน', tone: 'danger',
      });
      if (!ok) return;
      try {
        await ctx.data.rejectOrder(btn.dataset.reject);
        toast('ปฏิเสธรายการแล้ว', 'success');
        location.reload();
      } catch (err) { toast(err.message || 'ไม่สำเร็จ', 'error'); }
    });
  });

  // โหลดรูปสลิป + เปิดดูรูปใหญ่ + เปิดข้อมูลผู้ปกครอง
  const slipUrls = new Map();
  root.querySelectorAll('[data-slip-img]').forEach(async (img) => {
    const id = img.dataset.slipImg;
    try {
      const order = (await ctx.data.listAllOrders()).find((o) => o.id === id);
      if (!order?.slip_path) { img.remove(); return; }
      const url = await ctx.data.slipUrl(order.slip_path);
      slipUrls.set(id, url);
      img.src = url;
    } catch (err) { img.remove(); }
  });

  root.querySelectorAll('[data-slip-zoom]').forEach((box) => {
    box.addEventListener('click', async () => {
      const id = box.dataset.slipZoom;
      let url = slipUrls.get(id);
      if (!url) {
        const order = (await ctx.data.listAllOrders()).find((o) => o.id === id);
        if (order?.slip_path) url = await ctx.data.slipUrl(order.slip_path);
      }
      if (!url) { toast('เปิดรูปสลิปไม่สำเร็จ', 'error'); return; }
      openModal({
        title: 'สลิปการโอน',
        size: 'lg',
        body: `<div class="slip-lightbox"><img src="${e(url)}" alt="สลิปการโอน"></div>`,
        footer: `<button class="btn btn-ghost" type="button" data-modal-close>ปิด</button>`,
      });
    });
  });

  root.querySelectorAll('[data-open-teacher]').forEach((btn) => {
    btn.addEventListener('click', () => openTeacherDetail(btn.dataset.openTeacher, ctx));
  });

  root.querySelector('#teacher-org')?.addEventListener('change', (ev) => {
    location.hash = `#/dashboard?tab=teachers&torg=${encodeURIComponent(ev.currentTarget.value)}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  root.querySelectorAll('[data-open-parent]').forEach((btn) => {
    btn.addEventListener('click', () => openParentDetail(btn.dataset.openParent, ctx));
  });
  root.querySelectorAll('[data-add-student]').forEach((btn) => {
    btn.addEventListener('click', () => openAddStudent(btn.dataset.addStudent, ctx));
  });
  // ── หมวดหมู่คอร์ส ──────────────────────────────────────
  const addCat = root.querySelector('#add-category');
  if (addCat && !addCat.dataset.bound) {
    addCat.dataset.bound = '1';
    addCat.addEventListener('click', () => openCategoryDialog(ctx));
  }
  root.querySelectorAll('[data-edit-cat]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => openCategoryDialog(ctx, { id: btn.dataset.editCat, name: btn.dataset.catName || '' }));
  });
  root.querySelectorAll('[data-del-cat]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'ลบหมวดหมู่',
        message: 'คอร์สในหมวดนี้จะยังอยู่ แต่จะกลายเป็น "ยังไม่จัดหมวด" — ยืนยันลบ?',
        confirmLabel: 'ลบหมวด', tone: 'danger',
      });
      if (!ok) return;
      try {
        await ctx.data.deleteCategory(btn.dataset.delCat);
        toast('ลบหมวดหมู่แล้ว', 'success');
        location.reload();
      } catch (err) { toast(err.message || 'ลบไม่สำเร็จ', 'error'); }
    });
  });
  root.querySelectorAll('[data-move-cat]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      try { await ctx.data.moveCategory(btn.dataset.moveCat, Number(btn.dataset.dir)); location.reload(); }
      catch (err) { toast(err.message || 'สลับลำดับไม่สำเร็จ', 'error'); }
    });
  });
  root.querySelectorAll('[data-move-course]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      try { await ctx.data.moveCourse(btn.dataset.moveCourse, Number(btn.dataset.dir)); location.reload(); }
      catch (err) { toast(err.message || 'สลับลำดับไม่สำเร็จ', 'error'); }
    });
  });
  root.querySelectorAll('[data-home-toggle]').forEach((box) => {
    if (box.dataset.bound) return;
    box.dataset.bound = '1';
    box.addEventListener('change', async () => {
      try {
        await ctx.data.setCourseHome(box.dataset.homeToggle, box.checked);
        toast(box.checked ? 'แสดงในหน้าแรกแล้ว' : 'ซ่อนจากหน้าแรกแล้ว', 'success');
      } catch (err) { box.checked = !box.checked; toast(err.message || 'บันทึกไม่สำเร็จ', 'error'); }
    });
  });

  ctx._courses = (ctx._courses || []);
  bindCouponForm(root, ctx);

  root.querySelector('#cp-rand')?.addEventListener('click', () => {
    const input = root.querySelector('#cp-code');
    if (!input) return;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    input.value = Array.from({ length: 7 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  root.querySelector('#cp-clear-courses')?.addEventListener('click', () => {
    root.querySelectorAll('#cp-courses option').forEach((o) => { o.selected = false; });
    root.querySelector('#cp-courses')?.dispatchEvent(new Event('change', { bubbles: true }));
  });
  root.querySelector('#cp-image')?.addEventListener('change', async (ev) => {
    const file = ev.currentTarget.files?.[0];
    if (!file) return;
    try {
      const url = await ctx.data.uploadCouponImage(file);
      const box = root.querySelector('#cp-img-preview');
      if (box) box.innerHTML = `<img src="${url}" alt="" class="coupon-img-preview">`;
      toast('อัปโหลดรูปบัตรแล้ว', 'success');
    } catch (err) { toast(err.message || 'อัปโหลดไม่สำเร็จ', 'error'); }
  });
  root.querySelector('#cp-img-remove')?.addEventListener('click', () => {
    const box = root.querySelector('#cp-img-preview');
    if (box) box.innerHTML = '';
    toast('ลบรูปบัตรแล้ว', 'success');
  });

  root.querySelectorAll('[data-add-parent-to]').forEach((btn) => {
    btn.addEventListener('click', () => openAddParentForStudent(btn.dataset.addParentTo, ctx));
  });

  // คอร์ส
  root.querySelector('#c-save')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const id = root.querySelector('#c-id').value || undefined;
    btn.disabled = true;
    try {
      let image_url = '';
      const file = root.querySelector('#c-img-file').files?.[0];
      if (file) image_url = await ctx.data.uploadCover(file);
      await ctx.data.saveCourse({
        id, title: root.querySelector('#c-title').value.trim(),
        subtitle: root.querySelector('#c-sub').value.trim(),
        detail: root.querySelector('#c-detail').value.trim(),
        price: Number(root.querySelector('#c-price').value),
        hours: Number(root.querySelector('#c-hours').value),
        lessons: Number(root.querySelector('#c-lessons').value),
        seats: root.querySelector('#c-unlimited').checked ? 0 : Number(root.querySelector('#c-seats').value || 0),
        level: root.querySelector('#c-level').value.trim(),
        category_id: root.querySelector('#c-cat')?.value || null,
        show_on_home: root.querySelector('#c-home')?.checked !== false,
        image_url: image_url || root.querySelector('#c-img-preview')?.querySelector('img')?.getAttribute('src') || '',
      });
      toast('บันทึกคอร์สแล้ว', 'success');
      location.hash = '#/dashboard?tab=courses';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (err) {
      btn.disabled = false;
      toast(err.message || 'บันทึกไม่สำเร็จ', 'error');
    }
  });

  root.querySelectorAll('[data-del-course]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'ลบคอร์ส', message: 'ลบคอร์สนี้ถาวร?', confirmLabel: 'ลบ', tone: 'danger' });
      if (!ok) return;
      try {
        await ctx.data.deleteCourse(btn.dataset.delCourse);
        toast('ลบคอร์สแล้ว', 'success');
        location.reload();
      } catch (err) { toast(err.message || 'ลบไม่สำเร็จ', 'error'); }
    });
  });

  root.querySelector('#c-unlimited')?.addEventListener('change', (ev) => {
    const seats = root.querySelector('#c-seats');
    seats.disabled = ev.currentTarget.checked;
    if (ev.currentTarget.checked) seats.value = '';
    else if (!seats.value) seats.value = 8;
  });

  // ผู้ใช้งาน
  root.querySelector('#user-org')?.addEventListener('change', (ev) => {
    location.hash = `#/dashboard?tab=users&uorg=${encodeURIComponent(ev.currentTarget.value)}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  root.querySelectorAll('[data-open-teacher]').forEach((btn) => {
    btn.addEventListener('click', () => openTeacherDetail(btn.dataset.openTeacher, ctx));
  });

  root.querySelector('#teacher-org')?.addEventListener('change', (ev) => {
    location.hash = `#/dashboard?tab=teachers&torg=${encodeURIComponent(ev.currentTarget.value)}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  root.querySelectorAll('[data-open-parent]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mod = await import('./students.js');
      mod.openParentDetail(btn.dataset.openParent, ctx);
    });
  });

  // คูปอง
  root.querySelector('#cp-rand')?.addEventListener('click', () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 8; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
    root.querySelector('#cp-code').value = out;
  });
  root.querySelector('#cp-clear-courses')?.addEventListener('click', () => {
    root.querySelectorAll('#cp-courses option').forEach((o) => { o.selected = false; });
  });
  root.querySelector('#cp-unlimited')?.addEventListener('change', (ev) => {
    const max = root.querySelector('#cp-max');
    max.disabled = ev.currentTarget.checked;
    if (ev.currentTarget.checked) max.value = '';
    else if (!max.value) max.value = 10;
  });
  root.querySelector('#cp-img-remove')?.addEventListener('click', (ev) => {
    ev.currentTarget.dataset.removed = '1';
    root.querySelector('#cp-img-preview').innerHTML = '';
    ev.currentTarget.style.display = 'none';
    toast('จะลบรูปเมื่อกดบันทึก', 'success');
  });

  root.querySelector('#cp-save')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const sel = root.querySelector('#cp-courses');
    btn.disabled = true;
    try {
      const file = root.querySelector('#cp-image')?.files?.[0];
      let image_url = root.querySelector('#cp-img-remove')?.dataset.removed === '1' ? '' : undefined;
      if (file) image_url = await ctx.data.uploadCouponImage(file);
      await ctx.data.saveCoupon({
        id: root.querySelector('#cp-id').value || undefined,
        code: root.querySelector('#cp-code').value,
        title: root.querySelector('#cp-title').value,
        kind: root.querySelector('#cp-kind').value,
        value: root.querySelector('#cp-value').value,
        min_amount: root.querySelector('#cp-min').value,
        max_uses: root.querySelector('#cp-unlimited').checked ? 0 : root.querySelector('#cp-max').value,
        course_ids: [...sel.selectedOptions].map((o) => o.value),
        note: root.querySelector('#cp-note').value,
        image_url,
        expires_at: root.querySelector('#cp-exp').value ? new Date(`${root.querySelector('#cp-exp').value}T23:59:59`).toISOString() : null,
      });
      toast('บันทึกโค้ดแล้ว', 'success');
      location.hash = '#/dashboard?tab=coupons';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (err) {
      btn.disabled = false;
      toast(err.message || 'บันทึกไม่สำเร็จ', 'error');
    }
  });

  root.querySelectorAll('[data-del-coupon]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'ลบโค้ดส่วนลด', message: 'ลบโค้ดนี้ถาวร? ผู้ที่แลกไว้จะใช้ไม่ได้', confirmLabel: 'ลบ', tone: 'danger' });
      if (!ok) return;
      try {
        await ctx.data.deleteCoupon(btn.dataset.delCoupon);
        toast('ลบโค้ดแล้ว', 'success');
        location.reload();
      } catch (err) { toast(err.message || 'ลบไม่สำเร็จ', 'error'); }
    });
  });

  // ผูกนักเรียน
  root.querySelector('#link-add')?.addEventListener('click', async (ev) => {
    const parentId = root.querySelector('#link-parent').value;
    const studentId = root.querySelector('#link-student').value;
    if (!parentId || !studentId) { toast('เลือกผู้ปกครองและนักเรียน', 'error'); return; }
    const student = ctx._roster?.students?.find((s) => s.id === studentId);
    ev.currentTarget.disabled = true;
    try {
      await ctx.data.linkParentStudent(studentId, parentId);
      toast('ผูกนักเรียนแล้ว', 'success');
      location.reload();
    } catch (err) {
      ev.currentTarget.disabled = false;
      toast(err.message || 'ผูกไม่สำเร็จ', 'error');
    }
  });

  root.querySelectorAll('[data-unlink]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'เอานักเรียนออก', message: 'เอานักเรียนคนน็ออกจากบัญชีผู้ปกครองนี้?', confirmLabel: 'เอาออก', tone: 'danger' });
      if (!ok) return;
      try {
        await ctx.data.unlinkStudent(btn.dataset.unlink);
        toast('เอาออกแล้ว', 'success');
        location.reload();
      } catch (err) { toast(err.message || 'ไม่สำเร็จ', 'error'); }
    });
  });

  // ตั้งค่า
  root.querySelector('#s-save')?.addEventListener('click', async (ev) => {
    ev.currentTarget.disabled = true;
    try {
      await ctx.data.saveSettings({
        promptpay_type: root.querySelector('#s-type').value,
        promptpay_id: root.querySelector('#s-id').value.trim(),
        promptpay_name: root.querySelector('#s-name').value.trim(),
        contact_line: root.querySelector('#s-line').value.trim(),
        contact_phone: root.querySelector('#s-phone').value.trim(),
      });
      toast('บันทึกการตั้งค่าแล้ว', 'success');
    } catch (err) { toast(err.message || 'บันทึกไม่สำเร็จ', 'error'); }
    finally { ev.currentTarget.disabled = false; }
  });
}
