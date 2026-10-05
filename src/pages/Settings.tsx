import { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Save, Building2, Receipt, Upload, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { AppSettings } from '@/types';
import { Card, Button, Input } from '@/components/ui';
import Loading from '@/components/Loading';
import { validateFields, validateField, hasErrors, type FieldErrors } from '@/lib/utils';

const emptySettings: AppSettings = {
  id: 1,
  app_title: 'StockFlow',
  currency_symbol: '€',
  currency_code: 'EUR',
  company_name: '',
  company_address: '',
  company_phone: '',
  company_phone2: '',
  company_email: '',
  company_logo: '',
  rc: '',
  nif: '',
  ai: '',
  updated_at: '',
};

export default function Settings() {
  const { settings, refreshSettings } = useAuth();
  const [form, setForm] = useState<AppSettings>(settings || emptySettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(!settings);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setForm(settings);
      setLoading(false);
    } else if (!loading) {
      setForm(emptySettings);
    }
  }, [settings, loading]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(t);
  }, []);

  function update<K extends keyof AppSettings>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    const fieldErr = validateField(key, value);
    setErrors((prev) => ({ ...prev, [key]: fieldErr }));
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Erreur upload logo:', uploadError);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      update('company_logo', urlData.publicUrl);
    } finally {
      setUploadingLogo(false);
    }
  }

  function removeLogo() {
    update('company_logo', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSave() {
    const fieldErrors = validateFields({
      company_phone: form.company_phone,
      company_email: form.company_email,
      rc: form.rc,
      nif: form.nif,
      ai: form.ai,
    });
    if (hasErrors(fieldErrors)) {
      setErrors(fieldErrors);
      return;
    }
    setSaving(true);
    await supabase
      .from('app_settings')
      .update({
        app_title: form.app_title,
        currency_symbol: form.currency_symbol,
        currency_code: form.currency_code,
        company_name: form.company_name,
        company_address: form.company_address,
        company_phone: form.company_phone,
        company_phone2: form.company_phone2,
        company_email: form.company_email,
        company_logo: form.company_logo,
        rc: form.rc,
        nif: form.nif,
        ai: form.ai,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    setSaving(false);
    setSaved(true);
    await refreshSettings();
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-6 animate-fade-in-up max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Paramètres</h1>
        <p className="text-sm text-slate-500 mt-1">Configuration de l'application</p>
      </div>

      {/* Application */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-semibold text-slate-800">Application</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Titre de l'application" value={form.app_title} onChange={(v) => update('app_title', v)} />
          <Input label="Symbole monétaire" value={form.currency_symbol} onChange={(v) => update('currency_symbol', v)} />
          <Input label="Code devise" value={form.currency_code} onChange={(v) => update('currency_code', v)} />
        </div>
      </Card>

      {/* Entreprise */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="font-semibold text-slate-800">Entreprise</h3>
        </div>

        {/* Logo upload */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-2">Logo de l'entreprise</label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl border-2 border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 shrink-0">
              {form.company_logo ? (
                <img src={form.company_logo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon className="w-8 h-8 text-slate-300" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                <Upload className="w-4 h-4" />
                {uploadingLogo ? 'Chargement...' : 'Téléverser un logo'}
              </Button>
              {form.company_logo && (
                <button
                  onClick={removeLogo}
                  className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Supprimer le logo
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Le logo apparaîtra dans l'en-tête des bons de commande, factures et bons de livraison.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nom de l'entreprise" value={form.company_name} onChange={(v) => update('company_name', v)} />
          <Input label="Téléphone" value={form.company_phone} onChange={(v) => update('company_phone', v)} error={errors.company_phone} hint={!errors.company_phone ? 'ex: +212 6 12 34 56 78' : undefined} />
          <Input label="Téléphone 2" value={form.company_phone2} onChange={(v) => update('company_phone2', v)} hint="Numéro secondaire (optionnel)" />
          <Input label="Email" value={form.company_email} onChange={(v) => update('company_email', v)} error={errors.company_email} hint={!errors.company_email ? 'ex: contact@exemple.com' : undefined} />
          <Input label="Adresse" value={form.company_address} onChange={(v) => update('company_address', v)} />
        </div>
      </Card>

      {/* Identifiants fiscaux */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="font-semibold text-slate-800">Identifiants fiscaux et légaux</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label="RC (Registre de commerce)" value={form.rc} onChange={(v) => update('rc', v)} error={errors.rc} hint={!errors.rc ? 'ex: 99A9999999' : undefined} placeholder="99A9999999" />
          <Input label="NIF (N° d'identification fiscale)" value={form.nif} onChange={(v) => update('nif', v)} error={errors.nif} hint={!errors.nif ? '15 chiffres' : undefined} placeholder="123456789012345" />
          <Input label="AI (Article d'imposition)" value={form.ai} onChange={(v) => update('ai', v)} error={errors.ai} hint={!errors.ai ? '11 chiffres' : undefined} placeholder="12345678901" />
        </div>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
        </Button>
        {saved && (
          <span className="text-sm text-emerald-600 font-medium animate-fade-in">
            Paramètres enregistrés
          </span>
        )}
      </div>
    </div>
  );
}
