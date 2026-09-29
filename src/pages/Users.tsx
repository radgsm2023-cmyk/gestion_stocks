import { useState, useEffect } from 'react';
import { UserCog, Shield, User, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatDate, cn } from '@/lib/utils';
import type { Profile } from '@/types';
import { Card, Button, Select, Badge, ConfirmDialog } from '@/components/ui';
import Modal from '@/components/Modal';
import Loading from '@/components/Loading';

export default function Users() {
  const { profile: currentUser } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState('vendeur');
  const [saving, setSaving] = useState(false);
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
    setUsers(data || []);
    setLoading(false);
  }

  async function toggleActive(u: Profile) {
    await supabase.from('profiles').update({ active: !u.active }).eq('id', u.id);
    load();
  }

  async function handleEditSave() {
    if (!editUser) return;
    setSaving(true);
    await supabase.from('profiles').update({ role: editRole }).eq('id', editUser.id);
    setSaving(false);
    setEditUser(null);
    load();
  }

  async function handleDelete() {
    if (!deleteUser) return;
    await supabase.from('profiles').delete().eq('id', deleteUser.id);
    setDeleteUser(null);
    load();
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Utilisateurs</h1>
        <p className="text-sm text-slate-500 mt-1">{users.length} utilisateur(s)</p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left font-semibold text-slate-600 px-4 py-3">Utilisateur</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">Email</th>
                <th className="text-center font-semibold text-slate-600 px-4 py-3">Rôle</th>
                <th className="text-center font-semibold text-slate-600 px-4 py-3 hidden sm:table-cell">Statut</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3 hidden lg:table-cell">Créé le</th>
                <th className="text-right font-semibold text-slate-600 px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                        u.role === 'admin' ? 'bg-blue-50' : 'bg-slate-100'
                      )}>
                        {u.role === 'admin' ? (
                          <Shield className="w-4 h-4 text-blue-600" />
                        ) : (
                          <User className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">
                          {u.full_name || 'Sans nom'}
                          {u.id === currentUser?.id && (
                            <span className="text-xs text-slate-400 ml-2">(vous)</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400 md:hidden">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-600">{u.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
                      u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                    )}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <button
                      onClick={() => toggleActive(u)}
                      disabled={u.id === currentUser?.id}
                      className="inline-flex items-center gap-1.5 disabled:opacity-50"
                      title={u.active ? 'Désactiver' : 'Activer'}
                    >
                      {u.active ? (
                        <ToggleRight className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-slate-300" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditUser(u); setEditRole(u.role); }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Modifier le rôle"
                      >
                        <UserCog className="w-4 h-4" />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => setDeleteUser(u)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={!!editUser}
        onClose={() => setEditUser(null)}
        title="Modifier le rôle"
        subtitle={editUser?.email}
        size="sm"
      >
        <div className="space-y-4">
          <Select
            label="Rôle"
            value={editRole}
            onChange={setEditRole}
            options={[
              { value: 'admin', label: 'Administrateur' },
              { value: 'vendeur', label: 'Vendeur' },
            ]}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditUser(null)} className="flex-1">Annuler</Button>
            <Button onClick={handleEditSave} disabled={saving} className="flex-1">
              {saving ? '...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleDelete}
        title="Supprimer l'utilisateur"
        message={`Supprimer le compte de ${deleteUser?.email} ? Cette action est irréversible.`}
      />
    </div>
  );
}
