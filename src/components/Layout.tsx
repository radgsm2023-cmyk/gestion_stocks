import { useState, useEffect, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Package,
  Truck,
  Users,
  ShoppingCart,
  ArrowLeftRight,
  TrendingUp,
  Undo2,
  Boxes,
  Menu,
  X,
  Settings,
  UserCog,
  LogOut,
  Shield,
  MoreHorizontal,
} from 'lucide-react';
import type { PageKey } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

interface NavItem {
  key: PageKey;
  label: string;
  icon: typeof LayoutDashboard;
  group: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, group: 'Principal' },
  { key: 'products', label: 'Produits', icon: Package, group: 'Stock' },
  { key: 'suppliers', label: 'Fournisseurs', icon: Truck, group: 'Stock' },
  { key: 'customers', label: 'Clients', icon: Users, group: 'Stock' },
  { key: 'purchases', label: 'Achats', icon: ShoppingCart, group: 'Transactions' },
  { key: 'purchase-returns', label: 'Retours Achats', icon: Undo2, group: 'Transactions' },
  { key: 'sales', label: 'Ventes', icon: TrendingUp, group: 'Transactions' },
  { key: 'sales-returns', label: 'Retours Ventes', icon: ArrowLeftRight, group: 'Transactions' },
  { key: 'users', label: 'Utilisateurs', icon: UserCog, group: 'Administration', adminOnly: true },
  { key: 'settings', label: 'Paramètres', icon: Settings, group: 'Administration', adminOnly: true },
];

const bottomNavKeys: PageKey[] = ['dashboard', 'products', 'sales', 'purchases'];
const moreNavKeys: PageKey[] = ['suppliers', 'customers', 'purchase-returns', 'sales-returns'];

interface LayoutProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
}

export default function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { profile, settings, signOut } = useAuth();

  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
    setMoreOpen(false);
  }, [currentPage]);

  const isAdmin = profile?.role === 'admin';
  const appTitle = settings?.app_title || 'StockFlow';
  const visibleItems = navItems.filter((i) => !i.adminOnly || isAdmin);
  const groups = [...new Set(visibleItems.map((i) => i.group))];
  const currentItem = visibleItems.find((i) => i.key === currentPage);

  function handleNavigate(page: PageKey) {
    setMoreOpen(false);
    onNavigate(page);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-200 flex flex-col transition-transform duration-300 shadow-sidebar',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Boxes className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{appTitle}</h1>
            <p className="text-xs text-slate-400">Gestion de stock</p>
          </div>
          <button
            className="ml-auto lg:hidden text-slate-400 hover:text-white p-2 touch-target"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {groups.map((group) => (
            <div key={group} className="mb-6">
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {group}
              </p>
              <div className="space-y-1">
                {visibleItems
                  .filter((i) => i.group === group)
                  .map((item) => {
                    const Icon = item.icon;
                    const active = currentPage === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleNavigate(item.key)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 touch-target',
                          active
                            ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        )}
                      >
                        <Icon className="w-[18px] h-[18px] shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
              {isAdmin ? (
                <Shield className="w-4 h-4 text-brand-400" />
              ) : (
                <Users className="w-4 h-4 text-slate-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-200 truncate">
                {profile?.full_name || profile?.email}
              </p>
              <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors touch-target"
              title="Déconnexion"
              aria-label="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 py-3.5 flex items-center gap-4 sticky top-0 z-30 pt-safe">
          <button
            className="lg:hidden text-slate-600 p-2 -ml-2 touch-target"
            onClick={() => setMobileOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h2 className="text-lg font-bold text-slate-800 flex-1 truncate">
            {currentItem?.label}
          </h2>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden pb-nav lg:pb-8">{children}</main>

        {/* Bottom navigation - mobile only */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 shadow-card-hover pb-safe">
          <div className="flex items-stretch justify-around px-2">
            {bottomNavKeys.map((key) => {
              const item = navItems.find((n) => n.key === key)!;
              const Icon = item.icon;
              const active = currentPage === key;
              return (
                <button
                  key={key}
                  onClick={() => handleNavigate(key)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 px-3 py-2.5 flex-1 transition-colors touch-target',
                    active ? 'text-brand-600' : 'text-slate-400'
                  )}
                  aria-label={item.label}
                >
                  <Icon className={cn('w-5 h-5', active && 'stroke-[2.5]')} />
                  <span className="text-[10px] font-medium truncate max-w-[64px]">{item.label}</span>
                </button>
              );
            })}
            {/* More button */}
            <button
              onClick={() => setMoreOpen(true)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 px-3 py-2.5 flex-1 transition-colors touch-target',
                moreNavKeys.includes(currentPage) || (isAdmin && (currentPage === 'users' || currentPage === 'settings'))
                  ? 'text-brand-600'
                  : 'text-slate-400'
              )}
              aria-label="Plus"
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium">Plus</span>
            </button>
          </div>
        </nav>

        {/* More menu - mobile drawer */}
        {moreOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMoreOpen(false)}
            />
            <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-safe animate-slide-up max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Toutes les sections</h3>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg touch-target"
                  aria-label="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-6">
                {groups.map((group) => {
                  const items = visibleItems.filter((i) => i.group === group);
                  if (items.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className="px-2 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {group}
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {items.map((item) => {
                          const Icon = item.icon;
                          const active = currentPage === item.key;
                          return (
                            <button
                              key={item.key}
                              onClick={() => handleNavigate(item.key)}
                              className={cn(
                                'flex flex-col items-center gap-2 p-3 rounded-xl text-xs font-medium transition-colors touch-target',
                                active
                                  ? 'bg-brand-50 text-brand-600 border border-brand-200'
                                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                              )}
                            >
                              <Icon className="w-6 h-6" />
                              <span className="text-center leading-tight">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
