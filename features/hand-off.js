/*
 * features/hand-off.js - Hand a bid to another estimator (LEAD-ROLE, 2026-10-02).
 *
 * The Project Settings "Hand to…" button (#settingsHandOff, shown by app.js's
 * updateSettingsCheckoutSection for App.canTakeOver(): a lead or an admin) opens
 * #handOffModal: a user picker over list_users_for_project_invite (every user
 * but the current owner; the lead passes its user_can_access_project gate) and
 * a Hand off button that calls the reassign_project RPC. The server moves the
 * owner, renames the PDF under the new owner's folder, keeps the old owner on
 * the bid as an editor, releases the old owner's checkout and logs
 * project_reassigned. Here: refresh permissions (the row's owner changed under
 * us), redraw, toast.
 *
 * Deps read from App.* at call time: state, getSupabase, showModal, hideModal,
 * showToast, refreshProjectPermissions, updateUI, updateSettingsCheckoutSection,
 * escapeHtml, canTakeOver. Registers App.openHandOffModal (the spec seam).
 * Esc just hides the modal (nothing pending): no esc-ladder entry.
 */
(function () {
  const App = (window.App = window.App || {});

  async function openHandOffModal() {
    const state = App.state;
    if (!state.currentProjectId || !App.getSupabase() || !(App.canTakeOver && App.canTakeOver())) return;
    const select = document.getElementById('handOffUserSelect');
    const errEl = document.getElementById('handOffError');
    const nameEl = document.getElementById('handOffProjectName');
    const btn = document.getElementById('handOffConfirm');
    if (!select || !errEl || !btn) return;
    errEl.style.display = 'none';
    errEl.textContent = '';
    if (nameEl) nameEl.textContent = state.currentProjectName || 'this project';
    select.innerHTML = '<option value="">Loading…</option>';
    select.disabled = true;
    btn.disabled = true;
    App.hideModal('settingsModal');
    App.showModal('handOffModal');
    let users = null;
    let error = null;
    try {
      ({ data: users, error } = await App.getSupabase().rpc('list_users_for_project_invite', { p_project_id: state.currentProjectId }));
    } catch (e) {
      error = e;
    }
    if (error || !users) {
      select.innerHTML = '<option value="">Could not load users</option>';
      errEl.textContent = (error && error.message) || 'Could not load users.';
      errEl.style.display = 'block';
      return;
    }
    const esc = (v) => App.escapeHtml(String(v == null ? '' : v));
    select.innerHTML = '<option value="">Select an estimator…</option>' +
      users.map((u) => '<option value="' + esc(u.id) + '">' + esc(u.email || u.id) + '</option>').join('');
    select.disabled = false;
    select.onchange = () => { btn.disabled = !select.value; };
  }

  async function handOffCurrentProject() {
    const state = App.state;
    const select = document.getElementById('handOffUserSelect');
    const errEl = document.getElementById('handOffError');
    const btn = document.getElementById('handOffConfirm');
    const toUserId = select && select.value;
    if (!state.currentProjectId || !toUserId || !App.getSupabase()) return;
    const toEmail = select.options[select.selectedIndex]?.textContent || 'them';
    btn.disabled = true;
    const idle = btn.textContent;
    btn.textContent = 'Handing off…';
    let data = null;
    let error = null;
    try {
      ({ data, error } = await App.getSupabase().rpc('reassign_project', { p_project_id: state.currentProjectId, p_to_user_id: toUserId }));
    } catch (e) {
      error = e;
    } finally {
      btn.textContent = idle;
    }
    const result = data || (error ? { ok: false, error: error.message } : { ok: false });
    if (!result.ok) {
      errEl.textContent = result.error || 'Could not hand the project off.';
      errEl.style.display = 'block';
      btn.disabled = false;
      return;
    }
    App.hideModal('handOffModal');
    // The row's owner (and maybe its lock) changed under this tab: read it back.
    try { if (App.refreshProjectPermissions) await App.refreshProjectPermissions(); } catch (_) {}
    try { App.updateUI(); App.updateSettingsCheckoutSection && App.updateSettingsCheckoutSection(); } catch (_) {}
    App.showToast('Handed to ' + (result.to_email || toEmail) + '. ' + (result.from_email || 'The previous owner') + ' stays on it as an editor.', 5000);
  }

  const openBtn = document.getElementById('settingsHandOff');
  if (openBtn) openBtn.onclick = () => { openHandOffModal(); };
  const confirmBtn = document.getElementById('handOffConfirm');
  if (confirmBtn) confirmBtn.onclick = () => { handOffCurrentProject(); };
  const cancelBtn = document.getElementById('handOffCancel');
  if (cancelBtn) cancelBtn.onclick = () => { App.hideModal('handOffModal'); };

  App.openHandOffModal = openHandOffModal;
  App.handOffCurrentProject = handOffCurrentProject;
})();
