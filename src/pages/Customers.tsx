import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Customer } from '@/types';
import { Card, Button, Input, Textarea, EmptyState, ConfirmDialog } from '@/components/ui';
import Modal from '@/components/Modal';
import Loading from '@/components/Loading';
import { validateFields, validateField, hasErrors, type FieldErrors } from '@/lib/utils';

const emptyForm = { name: '', contact_person: '', email: '', phone: '', address: '', rc: '', nif: '', ai: '' };

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setCustomers(data || []);
    setLoading(false);
  }

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setForm(emptyForm);
    setEditId(null);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(c: Customer) {
    setForm({
      name: c.name,
      contact_person: c.contact_person,
      email: c.email,
      phone: c.phone,
      address: c.address,
      rc: c.rc || '',
      nif: c.nif || '',
      ai: c.ai || '',
    });
    setEditId(c.id);
    setErrors({});
    setModalOpen(true);
  }

  function updateField<K extends keyof typeof form>(key: K, value: string) {
    setForm({ ...form, [key]: value });
    const err = validateField(key, value);
    setErrors((prev) => ({ ...prev, [key]: err }));
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    const fieldErrors = validateFields({
      email: form.email,
      phone: form.phone,
      rc: form.rc,
      nif: form.nif,
      ai: form.ai,
    });
    if (hasErrors(fieldErrors)) {
      setErrors(fieldErrors);
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      contact_person: form.contact_person.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      rc: form.rc.trim(),
      nif: form.nif.trim(),
      ai: form.ai.trim(),
    };
    if (editId) {
      await supabase.from('customers').update(payload).eq('id', editId);
    } else {
      await supabase.from('customers').insert(payload);
    }
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from('customers').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clients</h1>
          <p className="text-sm text-slate-500 mt-1">{customers.length} client(s)</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" /> Nouveau client
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Aucun client"
            description="Ajoutez vos clients pour gérer vos ventes."
            action={
              <Button onClick={openAdd}>
                <Plus className="w-4 h-4" /> Ajouter
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Card key={c.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(c)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(c.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-slate-800">{c.name}</h3>
              {c.contact_person && <p className="text-sm text-slate-500">{c.contact_person}</p>}
              <div className="mt-3 space-y-1 text-sm text-slate-500">
                {c.email && <p>{c.email}</p>}
                {c.phone && <p>{c.phone}</p>}
                {c.address && <p className="text-xs text-slate-400">{c.address}</p>}
              </div>
              {(c.rc || c.nif || c.ai) && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-0.5 text-xs text-slate-400">
                  {c.rc && <p>RC: {c.rc}</p>}
                  {c.nif && <p>NIF: {c.nif}</p>}
                  {c.ai && <p>AI: {c.ai}</p>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Modifier le client' : 'Nouveau client'}
        size="md"
      >
        <div className="space-y-4">
          <Input label="Nom" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Input label="Personne de contact" value={form.contact_person} onChange={(v) => setForm({ ...form, contact_person: v })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.email} onChange={(v) => updateField('email', v)} error={errors.email} hint={!errors.email ? 'ex: contact@exemple.com' : undefined} />
            <Input label="Téléphone" value={form.phone} onChange={(v) => updateField('phone', v)} error={errors.phone} hint={!errors.phone ? 'ex: +212 6 12 34 56 78' : undefined} />
          </div>
          <Textarea label="Adresse" value={form.address} onChange={(v) => setForm({ ...form, address: v })} rows={2} />
          <div className="border-t border-slate-200 pt-4 mt-2">
            <p className="text-sm font-semibold text-slate-700 mb-3">Identifiants fiscaux</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="RC (Registre de commerce)" value={form.rc} onChange={(v) => updateField('rc', v)} error={errors.rc} hint={!errors.rc ? 'ex: 99A9999999' : undefined} placeholder="99A9999999" />
              <Input label="NIF (N° d'identification fiscale)" value={form.nif} onChange={(v) => updateField('nif', v)} error={errors.nif} hint={!errors.nif ? '15 chiffres' : undefined} placeholder="123456789012345" />
              <Input label="AI (Article d'imposition)" value={form.ai} onChange={(v) => updateField('ai', v)} error={errors.ai} hint={!errors.ai ? '11 chiffres' : undefined} placeholder="12345678901" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1">
              {saving ? 'Enregistrement...' : editId ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Supprimer le client"
        message="Êtes-vous sûr de vouloir supprimer ce client ?"
      />
    </div>
  );
}
