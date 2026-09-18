import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import axios from 'axios'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import type { ApiErrorBody } from '@/types/auth'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormValues = z.infer<typeof loginSchema>

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorBody | undefined
    if (data?.message) {
      return data.message
    }
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Login failed'
}

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await login(values.email, values.password)
      const redirectTo =
        typeof location.state === 'object' &&
        location.state &&
        'from' in location.state &&
        typeof location.state.from === 'string'
          ? location.state.from
          : '/'
      navigate(redirectTo, { replace: true })
    } catch (error) {
      setFormError(getErrorMessage(error))
    }
  })

  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Access your PharmaStock account.
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email ? (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
          />
          {errors.password ? (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          ) : null}
        </div>

        {formError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        Need an account?{' '}
        <Link className="font-medium text-primary hover:underline" to="/register">
          Register
        </Link>
      </p>
    </section>
  )
}
