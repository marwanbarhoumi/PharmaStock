import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useLocale } from '@/contexts/locale-context'
import { useTheme } from '@/hooks/use-theme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useLocale()

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}
