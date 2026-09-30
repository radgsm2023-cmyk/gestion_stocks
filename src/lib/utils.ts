let currencySymbol = '€';
let currencyCode = 'EUR';

export function setCurrencySettings(symbol: string, code: string) {
  currencySymbol = symbol || '€';
  currencyCode = code || 'EUR';
}

export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
  return `${formatted} ${currencySymbol}`;
}

export function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function generateReference(prefix: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${year}-${rand}`;
}

function dateStamp(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}${mm}${yyyy}`;
}

function seqNum(n: number): string {
  return String(n).padStart(3, '0');
}

export function generateSalesRef(seq: number): string {
  return `VENT-${seqNum(seq)}-${dateStamp()}`;
}

export function generatePurchaseRef(seq: number): string {
  return `ACH-${seqNum(seq)}-${dateStamp()}`;
}

export function generateBCRef(seq: number): string {
  return `BC-${seqNum(seq)}-${dateStamp()}`;
}

export function generateBLRef(seq: number): string {
  return `BL-${seqNum(seq)}-${dateStamp()}`;
}

export function generateFTRef(seq: number): string {
  return `FT-${seqNum(seq)}-${dateStamp()}`;
}

export async function getNextSeq(table: string): Promise<number> {
  const { supabase } = await import('@/lib/supabase');
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  return (count || 0) + 1;
}

export function cn(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ===== Validation patterns =====

export const patterns = {
  nif: { regex: /^\d{15,20}$/, label: 'NIF', format: '15 à 20 chiffres', example: '123456789012345' },
  ai: { regex: /^\d{11}$/, label: 'AI', format: '11 chiffres', example: '12345678901' },
  rc: { regex: /^\d{2}[A-Z]\d{7}$/, label: 'RC', format: '2 chiffres + 1 lettre + 7 chiffres', example: '99A9999999' },
  phone: { regex: /^[\d\s+().-]{8,20}$/, label: 'Téléphone', format: '8 à 20 caractères', example: '+212 6 12 34 56 78' },
  email: { regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, label: 'Email', format: 'adresse@email.com', example: 'contact@exemple.com' },
} as const;

export type FieldErrors = Record<string, string | undefined>;

export function validateField(field: string, value: string): string | undefined {
  const v = value.trim();
  if (!v) return undefined;

  switch (field) {
    case 'nif':
      if (!patterns.nif.regex.test(v)) return `Le NIF doit contenir ${patterns.nif.format} (ex: ${patterns.nif.example})`;
      break;
    case 'ai':
      if (!patterns.ai.regex.test(v)) return `L'AI doit contenir ${patterns.ai.format} (ex: ${patterns.ai.example})`;
      break;
    case 'rc':
      if (!patterns.rc.regex.test(v)) return `Le RC doit respecter le format: ${patterns.rc.format} (ex: ${patterns.rc.example})`;
      break;
    case 'phone':
      if (!patterns.phone.regex.test(v)) return `Numéro de téléphone invalide (ex: ${patterns.phone.example})`;
      break;
    case 'email':
      if (!patterns.email.regex.test(v)) return `Adresse email invalide (ex: ${patterns.email.example})`;
      break;
  }
  return undefined;
}

export function validateFields(fields: Record<string, string>): FieldErrors {
  const errors: FieldErrors = {};
  for (const [field, value] of Object.entries(fields)) {
    const err = validateField(field, value);
    if (err) errors[field] = err;
  }
  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some((v) => !!v);
}
