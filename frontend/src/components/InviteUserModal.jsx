import { useState } from "react";
import { Icon, Modal, ModalHead } from "./ui";
import { useApp } from "../lib/context";
import { errorMessage } from "../lib/api";

// Site admins invite admins and heads; heads invite trainers and trainees.
// No password is collected: the recipient sets one from the invitation link.
export function InviteUserModal({ onClose }) {
  const { model, api, reload, toast } = useApp();
  const isAdmin = model.me.role === "admin";
  const empty = { name: "", email: "", role: isAdmin ? "admin" : "trainee", batch: "", trainerId: "" };
  const [form, setForm] = useState(empty);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const trainers = model.users.filter((user) => user.role === "trainer");
  const batches = [...new Set(model.users.map((user) => user.batch).filter(Boolean))].sort();
  const set = (patch) => setForm((previous) => ({ ...previous, ...patch }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const response = await api.post("/user/invitations", form);
      if (response.data.emailSent) {
        toast(`Invitation email sent to ${form.email}.`);
        onClose();
      } else {
        setNotice(`Email is not configured. Share this invitation link: ${response.data.inviteUrl}`);
        setForm(empty);
      }
      await reload();
    } catch (error) {
      setNotice(errorMessage(error, "Could not create the invitation."));
    } finally {
      setSaving(false);
    }
  }

  return <Modal onClose={onClose} label="Invite a new user">
    <form onSubmit={submit}>
      <ModalHead title="Invite a new user" onClose={onClose} />
      <p>No password is collected. The recipient creates one from the invitation link.</p>
      {notice && <div className="form-notice">{notice}</div>}
      <div className="field"><label htmlFor="invite-name">Name</label><input id="invite-name" className="input" required value={form.name} onChange={(event) => set({ name: event.target.value })} placeholder="Full name" /></div>
      <div className="field"><label htmlFor="invite-email">Email</label><input id="invite-email" className="input" type="email" required value={form.email} onChange={(event) => set({ email: event.target.value })} placeholder="name@company.com" /></div>
      <div className="field"><label htmlFor="invite-role">Role</label><select id="invite-role" className="select" value={form.role} onChange={(event) => set({ role: event.target.value, batch: "", trainerId: "" })}>
        {isAdmin ? <><option value="admin">Site admin</option><option value="head">Organization head (training manager)</option></> : <><option value="trainee">Trainee</option><option value="trainer">Trainer</option></>}
      </select></div>
      {form.role === "trainee" && <>
        <div className="field"><label htmlFor="invite-batch">Batch (cohort)</label><input id="invite-batch" className="input" list="invite-batches" required value={form.batch} onChange={(event) => set({ batch: event.target.value })} placeholder="e.g. October Interns" /><datalist id="invite-batches">{batches.map((batch) => <option key={batch} value={batch} />)}</datalist></div>
        <div className="field"><label htmlFor="invite-trainer">Assigned trainer</label><select id="invite-trainer" className="select" required value={form.trainerId} onChange={(event) => set({ trainerId: event.target.value })}><option value="">Select trainer</option>{trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.name}</option>)}</select></div>
        {!trainers.length && <p className="tiny">Invite a trainer first. Every trainee needs an assigned trainer.</p>}
      </>}
      <div className="modal-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" type="submit" disabled={saving}><Icon name="mail" />{saving ? "Sending…" : "Send invitation"}</button></div>
    </form>
  </Modal>;
}
