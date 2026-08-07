/**
 * Private admin notes.
 *
 * Internal only — there is no candidate or employer serializer for these, by
 * design, so they cannot leak by accident. The panel says so out loud anyway,
 * because an admin who is unsure whether a note is visible will write nothing
 * useful in it.
 *
 * An author deletes their own notes; one admin does not erase another's record
 * of a conversation.
 */

import { useState } from 'react';
import { formatRelative, type NoteEntityType } from '@bktc/shared';
import { useAuth } from '../features/auth/auth-context.js';
import { ApiError } from '../lib/api-client.js';
import { useAddNote, useDeleteNote, useNotes } from '../features/admin/use-coordination.js';
import { Alert, Button } from './ui/index.js';

export function NotesPanel({
  entityType,
  entityId,
}: {
  entityType: NoteEntityType;
  entityId: string;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState('');

  const notes = useNotes(entityType, entityId, true);
  const add = useAddNote(entityType, entityId);
  const remove = useDeleteNote(entityType, entityId);

  const error = [add.error, remove.error].find((e) => e instanceof ApiError) as ApiError | undefined;

  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Internal notes
      </p>
      <p className="mt-0.5 text-xs text-slate-400">
        Only the BK team sees these. Never shown to the candidate or the company.
      </p>

      {error && (
        <div className="mt-3">
          <Alert tone="error">{error.message}</Alert>
        </div>
      )}

      <div className="mt-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          aria-label="Add an internal note"
          placeholder="Spoke to them on the 4th — open to Pune, not Chennai."
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base sm:text-sm"
        />
        <Button
          className="mt-2 px-3 text-xs"
          disabled={body.trim().length === 0}
          loading={add.isPending}
          onClick={() => add.mutate(body.trim(), { onSuccess: () => setBody('') })}
        >
          Add note
        </Button>
      </div>

      {notes.data && notes.data.items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {notes.data.items.map((note) => (
            <li key={note.id} className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm whitespace-pre-wrap text-slate-700">{note.body}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>{note.authorEmail}</span>
                <span>·</span>
                <span>{formatRelative(note.createdAt)}</span>
                {note.authorId === user?.id && (
                  <button
                    type="button"
                    onClick={() => remove.mutate(note.id)}
                    className="ml-auto text-accent-600 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
