'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { showWelcomeBack } from '@/lib/welcomeToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, PenSquare, ChevronLeft, Check } from 'lucide-react';

const schema = z
  .object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;
type AccountType = 'viewer' | 'blogger';

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    if (!accountType) return;
    setIsLoading(true);
    try {
      const newUser = await registerUser(
        values.username,
        values.email,
        values.password,
        accountType
      );
      // Same Dynamic-Island greeting used on sign-in — keeps the surprise
      // consistent so first-timers see the airplane animation too.
      showWelcomeBack(newUser.displayName || newUser.username);
      router.push(accountType === 'blogger' ? '/dashboard' : '/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response
        ?.data?.error?.message;
      toast.error(msg || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Step 1: Pick account type ────────────────────────────────────────────
  if (!accountType) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] px-4 py-10">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Join xBlog</h1>
            <p className="text-muted-foreground">How do you want to use xBlog?</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Viewer card */}
            <button
              onClick={() => setAccountType('viewer')}
              className="group text-left p-6 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 text-blue-600 mb-4 group-hover:scale-105 transition-transform">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg mb-1">I want to read</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Discover stories from developers around the world.
              </p>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" /> Browse all articles
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" /> Comment & react
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" /> Follow your favorite tags
                </li>
              </ul>
            </button>

            {/* Blogger card */}
            <button
              onClick={() => setAccountType('blogger')}
              className="group text-left p-6 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100 text-purple-600 mb-4 group-hover:scale-105 transition-transform">
                <PenSquare className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg mb-1">I want to write</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Share your ideas. Everything readers do, plus:
              </p>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" /> Write articles with rich editor
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" /> Dashboard with stats & analytics
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" /> Admin reviews before publishing
                </li>
              </ul>
            </button>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // ─── Step 2: Fill form ────────────────────────────────────────────────────
  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <button
            onClick={() => setAccountType(null)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors"
          >
            <ChevronLeft className="h-3 w-3" /> Change account type
          </button>
          <CardTitle className="text-2xl flex items-center gap-2">
            {accountType === 'blogger' ? (
              <>
                <PenSquare className="h-5 w-5 text-purple-600" /> Create a Writer Account
              </>
            ) : (
              <>
                <BookOpen className="h-5 w-5 text-blue-600" /> Create a Reader Account
              </>
            )}
          </CardTitle>
          <CardDescription>
            {accountType === 'blogger'
              ? 'Fill in your details to start writing on xBlog.'
              : 'Fill in your details to start reading on xBlog.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Username</label>
              <Input placeholder="yourname" {...register('username')} disabled={isLoading} />
              {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="you@example.com"
                {...register('email')}
                disabled={isLoading}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                {...register('password')}
                disabled={isLoading}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Confirm Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                {...register('confirmPassword')}
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
