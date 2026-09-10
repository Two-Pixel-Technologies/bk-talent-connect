/**
 * Contact enquiries.
 *
 * The public site's contact form writes here (P9). The queue exists now because
 * the API and the table already did, and an enquiry landing in a table nobody
 * can read is worse than no form at all.
 */

import { useState } from 'react';
import { formatDateTime, formatRelative } from '@bktc/shared';
import { ApiError } from '../../lib/api-client.js';
import { useEnquiries, useMarkEnquiryHandled } from '../../features/admin/use-coordination.js';
import { Alert, Badge, Button, Card, EmptyState } from '../../components/ui/index.js';
import { Pagination } from '../../components/pagination.js';
import { QueryState } from '../../components/query-state.js';

const TYPE_LABEL: Record<string, string> = {
  CANDIDATE: 'Looking for work',
  EMPLOYER: 'Hiring',
  OTHER: 'Something else',
};

export function EnquiriesPage() {
  const [showHandled, setShowHandled] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isPending, error, refetch } = useEnquiries(showHandled ? undefined : false, page);
  const mark = useMarkEnquiryHandled();
  const actionError = mark.error instanceof ApiError ? mark.error : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-pub-blue uppercase">Enquiries</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-900">Enquiries</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Messages from the contact form. Mark one handled once you have replied.
        </p>
      </div>

      {actionError && <Alert tone="error">{actionError.message}</Alert>}

      <label className="flex min-h-11 w-fit items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={showHandled}
          onChange={(e) => {
            setPage(1);
            setShowHandled(e.target.checked);
          }}
          className="size-4 rounded border-slate-300"
        />
        Include ones already handled
      </label>

      <QueryState isPending={isPending} error={error} onRetry={() => void refetch()}>
        {data && data.items.length === 0 ? (
          <EmptyState
            title="Nothing waiting"
            description="Messages from the public contact form land here."
          />
        ) : (
          <div className="space-y-3">
            {data?.items.map((enquiry) => (
              <Card key={enquiry.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-900">{enquiry.name}</p>
                    <p className="mt-0.5 text-sm break-words text-slate-600">
                      <a href={`mailto:${enquiry.email}`} className="text-brand-700 hover:underline">
                        {enquiry.email}
                      </a>
                      {enquiry.phone && <span className="ml-2">{enquiry.phone}</span>}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge tone="slate">{TYPE_LABEL[enquiry.enquiryType] ?? enquiry.enquiryType}</Badge>
                    {enquiry.handledAt && (
                      <Badge tone="green">Handled {formatRelative(enquiry.handledAt)}</Badge>
                    )}
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{enquiry.message}</p>

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-400">{formatDateTime(enquiry.createdAt)}</span>
                  <Button
                    variant={enquiry.handledAt ? 'ghost' : 'primary'}
                    className="ml-auto px-3 text-xs"
                    loading={mark.isPending}
                    onClick={() => mark.mutate({ id: enquiry.id, handled: !enquiry.handledAt })}
                  >
                    {enquiry.handledAt ? 'Reopen' : 'Mark handled'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </QueryState>

      {data && (
        <Pagination
          page={page}
          pageSize={data.pageSize}
          total={data.total}
          onChange={setPage}
          noun="enquiry"
        />
      )}
    </div>
  );
}
