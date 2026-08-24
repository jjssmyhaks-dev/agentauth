'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Bot,
  Shield,
  Activity,
  CheckSquare,
  Webhook,
  Settings,
  LogOut,
} from 'lucide-react';

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Agents', href: '/dashboard/agents', icon: Bot },
  { name: 'Grants', href: '/dashboard/grants', icon: Shield },
  { name: 'Approvals', href: '/dashboard/approvals', icon: CheckSquare },
  { name: 'Audit log', href: '/dashboard/activity', icon: Activity },
  { name: 'Webhooks', href: '/dashboard/webhooks', icon: Webhook },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [supabase, setSupabase] = useState<any>(null);

  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setSupabase(createClient());
      }
    });
  }, []);

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push('/');
  };

  return (
    <div className="flex flex-col w-56 bg-white border-r border-gray-200 min-h-screen">
      <div className="px-4 py-4 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          <span className="text-sm font-semibold">AgentAuth</span>
        </Link>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-gray-100">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
