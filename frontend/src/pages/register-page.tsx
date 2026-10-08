import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { useLocale } from '@/contexts/locale-context'
import type { ApiErrorBody } from '@/types/auth'

type RegisterFormValues = {
  firstName: string
  lastName: string
  email: string
  phone?: string
  password: string
}

export function RegisterPage() {
  const { register: registerUser, isAuthenticated, isLoading } = useAuth()
  const { t } = useLocale()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const registerSchema = useMemo(
    () =>
      z.object({
        firstName: z.string().trim().min(1, t('auth.validation.firstName')).max(80),
        lastName: z.string().trim().min(1, t('auth.validation.lastName')).max(80),
        email: z.string().email(t('auth.validation.email')),
        phone: z.string().trim().max(40).optional(),
        password: z.string().min(8, t('auth.validation.passwordMin')).max(128),
      }),
    [t],
  )

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
    },
  })

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await registerUser({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        phone: values.phone || undefined,
      })
      navigate('/', { replace: true })
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as ApiErrorBody | undefined
        setFormError(data?.message ?? t('auth.register.failed'))
        return
      }
      setFormError(
        error instanceof Error ? error.message : t('auth.register.failed'),
      )
    }
  })

  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('auth.register.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('auth.register.subtitle')}
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">{t('auth.field.firstName')}</Label>
            <Input id="firstName" {...register('firstName')} />
            {errors.firstName ? (
              <p className="text-sm text-destructive">{errors.firstName.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">{t('auth.field.lastName')}</Label>
            <Input id="lastName" {...register('lastName')} />
            {errors.lastName ? (
              <p className="text-sm text-destructive">{errors.lastName.message}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t('auth.field.email')}</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email ? (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">{t('auth.field.phone')}</Label>
          <Input id="phone" type="tel" {...register('phone')} />
          {errors.phone ? (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.field.password')}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
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
          {isSubmitting
            ? t('auth.register.submitting')
            : t('auth.register.submit')}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {t('auth.register.haveAccount')}{' '}
        <Link className="font-medium text-primary hover:underline" to="/login">
          {t('nav.signIn')}
        </Link>
      </p>
    </section>
  )
}
