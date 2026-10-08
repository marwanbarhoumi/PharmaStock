import { Button } from '@/components/ui/button'
import { useLocale } from '@/contexts/locale-context'
import type { PaginationMeta } from '@/services/dashboard-api'

interface PaginationBarProps {
  pagination?: PaginationMeta
  page: number
  onPageChange: (page: number) => void
}

export function PaginationBar({ pagination, page, onPageChange }: PaginationBarProps) {
  const { t } = useLocale()
  if (!pagination || pagination.totalPages <= 1) return null

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        {t('common.previous')}
      </Button>
      <p className="text-sm text-muted-foreground">
        {t('common.pageOf', {
          page: pagination.page,
          totalPages: pagination.totalPages,
          total: pagination.total,
        })}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= pagination.totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t('common.next')}
      </Button>
    </div>
  )
}
