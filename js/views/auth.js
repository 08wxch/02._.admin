/* ── ล็อกอินครู/เจ้าของ ด้วยรหัสจาก 02._.mock ──────────── */
export async function renderTeacherAuth(_arg, ctx) {
  if (ctx.me) { location.hash = '#/'; return ''; }

  const html = `
  <div class="wrap" style="max-width:480px;padding-top:56px">
    <div class="book-card">
      <h1 style="font-family:var(--brand-font);font-size:23px;margin:8px 0 6px">เข้าสู่ระบบหลังบ้าน</h1>
      <p class="tiny dim" style="margin:0 0 18px">ใช้รหัสครู / ชื่อ / อีเมล + รหัสผ่านชุดเดียวกับที่เข้า 02._.mock</p>

      <div class="field-row"><label>รหัสครู</label>
        <input id="t-code" placeholder="เช่น 02._.math" autocomplete="username"></div>
      <div class="field-row"><label>รหัสผ่าน</label>
        <input id="t-pass" type="password" autocomplete="current-password" placeholder="รหัสผ่าน"></div>
      <button class="btn btn-primary btn-block" id="t-login">เข้าสู่ระบบ</button>


    </div>
  </div>`;

  setTimeout(() => {
    const root = document.getElementById('app');
    const submit = async () => {
      const code = root.querySelector('#t-code').value.trim();
      const pass = root.querySelector('#t-pass').value;
      if (!code || !pass) { toast('กรอกรหัสครูและรหัสผ่าน', 'error'); return; }
      const btn = root.querySelector('#t-login');
      btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ…';
      try {
        const acc = await ctx.data.signInTeacher(code, pass);
        toast('เข้าสู่ระบบแล้ว', 'success');
        location.hash = '#/dashboard';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (err) {
        btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
        toast(err.message || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
      }
    };
    root.querySelector('#t-login').addEventListener('click', submit);
    root.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') submit(); }));

  }, 0);

  return html;
}

/** หลังสมัคร: ให้ผู้ปกครองเลือกโรงเรียน/หน่วยงานของลูก (เลือกได้หลายที่) */
export async function askSchools(ctx) {
  let orgs = [];
  try { orgs = await ctx.data.listOrganizations(); } catch (err) { orgs = []; }
  if (!orgs.length) return;

  return new Promise((resolve) => {
    const overlay = openModal({
      title: 'เลือกโรงเรียน/หน่วยงานของบุตรหลาน',
      size: 'sm',
      body: `
        <p class="tiny dim" style="margin:0 0 12px">เลือกได้มากกว่า 1 โรงเรียน — ใช้เพื่อให้ครูในโรงเรียนนั้นเห็นและเพิ่มรายชื่อนักเรียนของท่าน</p>
        <div class="school-list">
          ${orgs.map((o) => `<label class="check-line">
            <input type="checkbox" value="${o.id}">
            <span>${o.name}${o.type ? ` <span class="tiny dim">(${o.type === 'school' ? 'โรงเรียน' : 'หน่วยงาน'})</span>` : ''}</span>
          </label>`).join('')}
        </div>
        <p class="hint" style="margin-top:12px">หลังเลือกแล้ว ติดต่อครูหรือบุคลากรเพื่อเพิ่มรายชื่อนักเรียนของท่าน</p>`,
      footer: `<button class="btn btn-ghost" type="button" data-cancel>ข้ามไปก่อน</button>
               <button class="btn btn-primary" type="button" data-save>บันทึก</button>`,
      onMount: (root) => {
        root.querySelector('[data-save]')?.addEventListener('click', async () => {
          const ids = [...root.querySelectorAll('input[type=checkbox]:checked')].map((i) => i.value);
          try {
            await ctx.data.setMyOrgs(ids);
            if (ids.length) toast('บันทึกโรงเรียนแล้ว — ติดต่อครูเพื่อเพิ่มรายชื่อนักเรียน', 'success');
          } catch (err) {
            toast(err.message || 'บันทึกไม่สำเร็จ', 'error');
          }
          resolve(true);
          closeModal();
        });
        root.querySelector('[data-cancel]')?.addEventListener('click', async () => {
          resolve(false);
          closeModal();
        });
        root.querySelector('.modal__close')?.addEventListener('click', () => resolve(false));
      },
    });
    if (!overlay) resolve(false);
  });
}
