'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  SUPPORT_TICKET_DESCRIPTION_MAX,
  SUPPORT_TICKET_SUBJECTS,
  SUPPORT_TICKET_SUBJECT_LABELS,
  SUPPORT_TICKET_TITLE_MAX,
  type SupportTicketSubject,
} from '@/lib/constants';
import { cn } from '@/lib/utils';

type FieldName = 'subject' | 'title' | 'description';

export function SupportForm() {
  const queryClient = useQueryClient();
  const [subject, setSubject] = React.useState<SupportTicketSubject | ''>('');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [touched, setTouched] = React.useState<Record<FieldName, boolean>>({
    subject: false,
    title: false,
    description: false,
  });
  const [serverFieldError, setServerFieldError] = React.useState<{
    field: FieldName;
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const titleRef = React.useRef<HTMLInputElement>(null);
  const descriptionRef = React.useRef<HTMLTextAreaElement>(null);

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();

  const subjectError = !subject ? 'Please choose a subject.' : null;
  const titleError = !trimmedTitle
    ? 'Title is required.'
    : trimmedTitle.length > SUPPORT_TICKET_TITLE_MAX
      ? `Title must be ${SUPPORT_TICKET_TITLE_MAX} characters or fewer.`
      : null;
  const descriptionError = !trimmedDescription
    ? 'Description is required.'
    : trimmedDescription.length > SUPPORT_TICKET_DESCRIPTION_MAX
      ? `Description must be ${SUPPORT_TICKET_DESCRIPTION_MAX} characters or fewer.`
      : null;

  const showError = (field: FieldName): string | null => {
    if (serverFieldError?.field === field) return serverFieldError.message;
    if (!touched[field]) return null;
    if (field === 'subject') return subjectError;
    if (field === 'title') return titleError;
    return descriptionError;
  };

  const reset = () => {
    setSubject('');
    setTitle('');
    setDescription('');
    setTouched({ subject: false, title: false, description: false });
    setServerFieldError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ subject: true, title: true, description: true });
    setServerFieldError(null);

    if (subjectError || titleError || descriptionError) {
      if (subjectError) return;
      if (titleError) {
        titleRef.current?.focus();
        return;
      }
      if (descriptionError) {
        descriptionRef.current?.focus();
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          title: trimmedTitle,
          description: trimmedDescription,
        }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string;
          field?: FieldName;
        };
        const msg = String(errBody.error ?? 'Failed to send ticket');
        if (errBody.field === 'subject' || errBody.field === 'title' || errBody.field === 'description') {
          setServerFieldError({ field: errBody.field, message: msg });
          return;
        }
        throw new Error(msg);
      }
      toast.success('Ticket sent. We’ll get back to you by email.');
      reset();
      await queryClient.invalidateQueries({ queryKey: ['support', 'mine'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New ticket</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <Label htmlFor="support-subject">Subject</Label>
            <Select
              value={subject}
              onValueChange={(value) => {
                setSubject(value as SupportTicketSubject);
                if (serverFieldError?.field === 'subject') setServerFieldError(null);
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger
                id="support-subject"
                aria-invalid={showError('subject') ? true : undefined}
                aria-describedby={showError('subject') ? 'support-subject-error' : undefined}
                className={cn(
                  showError('subject') && 'border-destructive focus-visible:ring-destructive'
                )}
                onBlur={() => setTouched((t) => ({ ...t, subject: true }))}
              >
                <SelectValue placeholder="Choose a subject" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORT_TICKET_SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SUPPORT_TICKET_SUBJECT_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id="support-subject-error" message={showError('subject') || undefined} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="support-title">Title</Label>
            <Input
              id="support-title"
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (serverFieldError?.field === 'title') setServerFieldError(null);
              }}
              onBlur={() => setTouched((t) => ({ ...t, title: true }))}
              disabled={isSubmitting}
              maxLength={SUPPORT_TICKET_TITLE_MAX}
              placeholder="One-line summary"
              aria-invalid={showError('title') ? true : undefined}
              aria-describedby={showError('title') ? 'support-title-error' : undefined}
              className={cn(
                showError('title') && 'border-destructive focus-visible:ring-destructive'
              )}
            />
            <FieldError id="support-title-error" message={showError('title') || undefined} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="support-description">Description</Label>
            <Textarea
              id="support-description"
              ref={descriptionRef}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (serverFieldError?.field === 'description') setServerFieldError(null);
              }}
              onBlur={() => setTouched((t) => ({ ...t, description: true }))}
              disabled={isSubmitting}
              maxLength={SUPPORT_TICKET_DESCRIPTION_MAX}
              rows={8}
              placeholder="Steps to reproduce, account details, payment reference, etc."
              aria-invalid={showError('description') ? true : undefined}
              aria-describedby={
                showError('description') ? 'support-description-error' : 'support-description-help'
              }
              className={cn(
                showError('description') && 'border-destructive focus-visible:ring-destructive'
              )}
            />
            <div className="flex items-center justify-between text-xs">
              {!showError('description') ? (
                <p id="support-description-help" className="text-muted-foreground">
                  Be specific — it helps us reply faster.
                </p>
              ) : (
                <span aria-hidden="true" />
              )}
              <span
                className={cn(
                  'text-muted-foreground tabular-nums',
                  description.length >= SUPPORT_TICKET_DESCRIPTION_MAX && 'text-destructive'
                )}
              >
                {description.length} / {SUPPORT_TICKET_DESCRIPTION_MAX}
              </span>
            </div>
            <FieldError
              id="support-description-error"
              message={showError('description') || undefined}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Submit ticket'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
