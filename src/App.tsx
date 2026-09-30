import { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import Layout from '@/components/Layout';
import Loading from '@/components/Loading';
import AuthPage from '@/pages/AuthPage';
import Dashboard from '@/pages/Dashboard';
import Products from '@/pages/Products';
import Suppliers from '@/pages/Suppliers';
import Customers from '@/pages/Customers';
import Purchases from '@/pages/Purchases';
import Sales from '@/pages/Sales';
import PurchaseReturns from '@/pages/PurchaseReturns';
import SalesReturns from '@/pages/SalesReturns';
import Invoices from '@/pages/Invoices';
import Users from '@/pages/Users';
import Settings from '@/pages/Settings';
import type { PageKey } from '@/types';

function AppContent() {
  const { session, profile, loading } = useAuth();
  const [page, setPage] = useState<PageKey>('dashboard');

  if (loading) return <Loading />;

  if (!session || !profile) return <AuthPage />;

  if (!profile.active) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Compte désactivé</h2>
          <p className="text-sm text-slate-500">
            Votre compte a été désactivé. Contactez un administrateur.
          </p>
        </div>
      </div>
    );
  }

  const isAdmin = profile.role === 'admin';
  const adminOnlyPages: PageKey[] = ['users', 'settings'];
  const effectivePage = adminOnlyPages.includes(page) && !isAdmin ? 'dashboard' : page;

  return (
    <Layout currentPage={effectivePage} onNavigate={setPage}>
      {effectivePage === 'dashboard' && <Dashboard onNavigate={setPage} />}
      {effectivePage === 'products' && <Products />}
      {effectivePage === 'suppliers' && <Suppliers />}
      {effectivePage === 'customers' && <Customers />}
      {effectivePage === 'purchases' && <Purchases />}
      {effectivePage === 'sales' && <Sales />}
      {effectivePage === 'purchase-returns' && <PurchaseReturns />}
      {effectivePage === 'sales-returns' && <SalesReturns />}
      {effectivePage === 'invoices' && <Invoices />}
      {effectivePage === 'users' && isAdmin && <Users />}
      {effectivePage === 'settings' && isAdmin && <Settings />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
