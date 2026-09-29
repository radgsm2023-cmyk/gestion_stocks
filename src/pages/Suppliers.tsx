import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Supplier } from '@/types';
import { Card, Button, Input, Textarea, EmptyState, ConfirmDialog } from '@/components/ui';
import Modal from '@/components/Modal';
import Loading from '@/components/Loading';
import { validateFields, validateField, hasErrors, type FieldErrors } from '@/lib/utils';

const emptyForm = { name: '', contact_person: '', email: '', phone: '', address: '' };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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
    const { data } = await supabase.from('suppliers').select('*').order('created_at', { ascending: false });
    setSuppliers(data || []);
    setLoading(false);
  }

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setForm(emptyForm);
    setEditId(null);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(s: Supplier) {
    setForm({
      name: s.name,
      contact_person: s.contact_person,
      email: s.email,
      phone: s.phone,
      address: s.address,
    });
    setEditId(s.id);
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
    };
    if (editId) {
      await supabase.from('suppliers').update(payload).eq('id', editId);
    } else {
      await supabase.from('suppliers').insert(payload);
    }
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from('suppliers').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fournisseurs</h1>
          <p className="text-sm text-slate-500 mt-1">{suppliers.length} fournisseur(s)</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" /> Nouveau fournisseur
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
            icon={Truck}
            title="Aucun fournisseur"
            description="Ajoutez vos fournisseurs pour gérer vos achats."
            action={
              <Button onClick={openAdd}>
                <Plus className="w-4 h-4" /> Ajouter
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <Card key={s.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(s)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(s.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-slate-800">{s.name}</h3>
              {s.contact_person && <p className="text-sm text-slate-500">{s.contact_person}</p>}
              <div className="mt-3 space-y-1 text-sm text-slate-500">
                {s.email && <p>{s.email}</p>}
                {s.phone && <p>{s.phone}</p>}
                {s.address && <p className="text-xs text-slate-400">{s.address}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
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
        title="Supprimer le fournisseur"
        message="Êtes-vous sûr de vouloir supprimer ce fournisseur ?"
      />
    </div>
  );
}
