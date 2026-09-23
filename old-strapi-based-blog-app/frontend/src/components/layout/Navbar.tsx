'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getStrapiMediaUrl } from '@/lib/api';
import NotificationBell from '@/components/layout/NotificationBell';
import UpgradeToBloggerModal from '@/components/layout/UpgradeToBloggerModal';
import { useState } from 'react';
import { PenSquare, LayoutDashboard, BarChart2, LogOut, ShieldCheck } from 'lucide-react';

export default function Navbar() {
  const { user, isLoading, logout, isAdmin, isBlogger } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // (Notification polling lives inside <NotificationBell />, which is
  // rendered below in the navbar's right cluster.)

  // Reader → blogger upgrade modal. Triggered when a reader clicks the
  // Write button in the navbar.
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const isReader = !!user && user.role?.type === 'authenticated';

  // Admin routes use their own shell — hide public navbar
  if (pathname?.startsWith('/admin')) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 flex h-14 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <span className="text-primary">x</span>
          <span>Blog</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          ) : user ? (
            <>
              {/* Write button — always shown to signed-in users except on
                  the writer page itself. Readers (authenticated role) get
                  an upgrade confirmation modal instead of a direct link
                  to /write, because their role isn't allowed to create
                  articles yet. Bloggers / admins go straight to /write. */}
              {pathname !== '/write' && (isBlogger() || isAdmin() ? (
                <Button asChild size="sm" className="gap-1.5">
                  <Link href="/write">
                    <PenSquare className="h-4 w-4" />
                    Write
                  </Link>
                </Button>
              ) : isReader ? (
                <Button size="sm" className="gap-1.5" onClick={() => setUpgradeOpen(true)}>
                  <PenSquare className="h-4 w-4" />
                  Write
                </Button>
              ) : null)}

              {/* Quick dashboard shortcut — direct click on avatar for writers/admins */}
              {(isBlogger() || isAdmin()) && (
                <button
                  onClick={() => router.push('/dashboard')}
                  title="Go to dashboard"
                  className="hidden md:inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </button>
              )}

              {/* Notification bell — always visible, polls every 25s,
                  shakes + toasts when a new notification arrives. */}
              <NotificationBell />

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={getStrapiMediaUrl(user.profilePicture?.url)}
                      alt={user.displayName || user.username}
                    />
                    <AvatarFallback className="text-xs font-semibold">
                      {(user.displayName || user.username).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-2 py-1.5">
                    <p className="font-medium text-sm">{user.displayName || user.username}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => router.push(`/profile/${user.username}`)}
                  >
                    Profile
                  </DropdownMenuItem>
                  {(isBlogger() || isAdmin()) && (
                    <>
                      <DropdownMenuItem
                        className="cursor-pointer gap-2"
                        onClick={() => router.push('/dashboard')}
                      >
                        <LayoutDashboard className="h-4 w-4" /> Dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer gap-2"
                        onClick={() => router.push('/analytics')}
                      >
                        <BarChart2 className="h-4 w-4" /> Analytics
                      </DropdownMenuItem>
                    </>
                  )}
                  {isAdmin() && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer gap-2 text-orange-600"
                        onClick={() => router.push('/admin')}
                      >
                        <ShieldCheck className="h-4 w-4" /> Admin Panel
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive cursor-pointer gap-2"
                    onClick={logout}
                  >
                    <LogOut className="h-4 w-4" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Reader → blogger upgrade modal — only shown when the
                  reader clicked the Write button. */}
              <UpgradeToBloggerModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
