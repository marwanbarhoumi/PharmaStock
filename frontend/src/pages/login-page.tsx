import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import axios from 'axios'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { useLocale } from '@/contexts/locale-context'
import type { ApiErrorBody } from '@/types/auth'

type LoginFormValues = {
  email: string
  password: string
}

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const { t } = useLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('auth.validation.email')),
        password: z.string().min(1, t('auth.validation.passwordRequired')),
      }),
    [t],
  )

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
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          setFormError(t('auth.login.networkError'))
          return
        }
        const status = error.response.status
        if (status === 401) {
          setFormError(t('auth.login.invalidCredentials'))
          return
        }
        if (status === 403) {
          setFormError(t('auth.login.accountDisabled'))
          return
        }
        if (status === 422 || status === 400) {
          const data = error.response.data as ApiErrorBody | undefined
          setFormError(data?.message ?? t('auth.login.failed'))
          return
        }
        const data = error.response.data as ApiErrorBody | undefined
        setFormError(data?.message ?? t('auth.login.failed'))
        return
      }
      setFormError(
        error instanceof Error ? error.message : t('auth.login.failed'),
      )
    }
  })

  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('auth.login.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('auth.login.subtitle')}</p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">{t('auth.field.email')}</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email ? (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.field.password')}</Label>
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
          {isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {t('auth.login.needAccount')}{' '}
        <Link className="font-medium text-primary hover:underline" to="/register">
          {t('nav.register')}
        </Link>
      </p>
    </section>
  )
}
