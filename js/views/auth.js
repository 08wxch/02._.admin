/* ── ล็อกอินครู/เจ้าของ (ใช้บัญชีเดียวกับ 02._.mock) ──────── */
export async function renderTeacherAuth(_arg, ctx) {
  if (ctx.me) { location.hash = '#/dashboard'; return ''; }

  const html = `
  <div class="login-shell">
    <div class="login-main">
      <div class="login-main__inner">
        <div class="login-card">
          <span class="login-eyebrow">สำหรับครูและเจ้าของระบบ</span>
          <h2>เข้าสู่ระบบ</h2>
          <p class="login-lead">ใช้บัญชีเดียวกับระบบ <strong>02._.mock</strong></p>

          <form class="login-form" id="login-form" novalidate>
            <div class="field">
              <label class="field__label" for="t-code">รหัสครู หรือ ชื่อ–นามสกุล</label>
              <div class="input-wrap">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input class="input input--lg" id="t-code" type="text" autocomplete="username"
                  placeholder="เช่น 02._.math หรือ Wich Pitchon">
              </div>
            </div>

            <div class="field">
              <label class="field__label" for="t-pass">รหัสผ่าน</label>
              <div class="input-wrap">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <input class="input input--lg" id="t-pass" type="password" autocomplete="current-password" placeholder="••••••••">
                <button class="input-wrap__action" type="button" id="t-eye" aria-label="แสดงรหัสผ่าน">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
            </div>

            <div class="form-error" id="t-error"><span></span></div>

            <button class="btn btn-primary btn-lg btn-block login-submit" type="submit" id="t-login">
              เข้าสู่ระบบ
            </button>
          </form>

          <div class="login-hint">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>
            <p>หากลืมรหัสผ่าน ติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่าน</p>
          </div>

          <div class="login-card__foot">
            <span>02._.admin · ระบบเดียวกับ 02._.mock</span>
            <span>2569</span>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  setTimeout(() => {
    const root = document.getElementById('app');
    const form = root.querySelector('#login-form');
    const errBox = root.querySelector('#t-error');
    const btn = root.querySelector('#t-login');
    const input = root.querySelector('#t-code');
    const pass = root.querySelector('#t-pass');

    root.querySelector('#t-eye')?.addEventListener('click', () => {
      pass.type = pass.type === 'password' ? 'text' : 'password';
    });

    const showError = (msg) => {
      errBox.querySelector('span').textContent = msg;
      errBox.classList.add('is-visible');
    };
    const clearError = () => errBox.classList.remove('is-visible');

    form?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      clearError();
      if (!input.value.trim() || !pass.value) {
        showError('กรอกรหัสครูและรหัสผ่าน');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'กำลังเข้าสู่ระบบ…';
      try {
        const acc = await ctx.data.signInTeacher(input.value.trim(), pass.value);
        toast('เข้าสู่ระบบแล้ว', 'success');
        location.hash = '#/dashboard';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'เข้าสู่ระบบ';
        showError(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
      }
    });
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
