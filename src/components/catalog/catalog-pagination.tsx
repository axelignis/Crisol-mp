'use client'

import { useSearchParams } from 'next/navigation'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination'

interface CatalogPaginationProps {
  currentPage: number
  totalPages: number
}

export function CatalogPagination({ currentPage, totalPages }: CatalogPaginationProps) {
  const searchParams = useSearchParams()

  if (totalPages <= 1) return null

  function pageHref(page: number): string {
    const params = new URLSearchParams(searchParams.toString())
    if (page <= 1) {
      params.delete('pagina')
    } else {
      params.set('pagina', String(page))
    }
    return `?${params.toString()}`
  }

  // Show at most 5 page numbers centered around current
  const pages: (number | 'ellipsis')[] = []
  const delta = 2
  const rangeStart = Math.max(2, currentPage - delta)
  const rangeEnd = Math.min(totalPages - 1, currentPage + delta)

  pages.push(1)
  if (rangeStart > 2) pages.push('ellipsis')
  for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i)
  if (rangeEnd < totalPages - 1) pages.push('ellipsis')
  if (totalPages > 1) pages.push(totalPages)

  return (
    <Pagination className="mt-8">
      <PaginationContent>
        {currentPage > 1 && (
          <PaginationItem>
            <PaginationPrevious href={pageHref(currentPage - 1)} text="Anterior" size="default" />
          </PaginationItem>
        )}
        {pages.map((page, idx) =>
          page === 'ellipsis' ? (
            <PaginationItem key={`ellipsis-${idx}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={page}>
              <PaginationLink href={pageHref(page)} isActive={page === currentPage} size="icon">
                {page}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        {currentPage < totalPages && (
          <PaginationItem>
            <PaginationNext href={pageHref(currentPage + 1)} text="Siguiente" size="default" />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  )
}
