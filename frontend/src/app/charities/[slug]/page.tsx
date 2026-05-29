import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';

import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { CHARITIES, type Charity } from '@/lib/constants';

type CharityContent = {
  paragraphs: string[];
  signature?: string;
};

const CHARITY_CONTENT: Record<string, CharityContent> = {
  'canadian-cancer-society': {
    paragraphs: [
      'A portion of the proceeds will be donated to cancer research, a cause that is deeply personal to me and my family. I lost my father to colon cancer, and my wife has courageously battled breast cancer. Through these experiences, I’ve seen firsthand the impact cancer has on individuals and families. Supporting cancer research is my way of honoring my father, supporting my wife, and helping contribute toward better treatments, early detection, and ultimately a cure for future generations.',
    ],
    signature: '— Nick',
  },
  'islamic-relief-canada': {
    paragraphs: [
      'Proceeds will also be donated to Islamic Relief Canada.',
      'The decision came from a hard reaction to what’s happening in Gaza. The destruction is on a scale that’s difficult for me to absorb — nearly two million people displaced, homes, hospitals, and schools reduced to rubble, and children going hungry on a massive scale. Suffering of this magnitude is not something any of us should be able to watch and simply move past. Choosing to do nothing didn’t sit right with me.',
      'So we’re choosing to do something concrete instead. These contributions help deliver food, clean water, medical care, and shelter to families who have lost nearly everything. It’s a modest act against an overwhelming need — but it’s one I stand behind.',
    ],
    signature: '— David',
  },
};

function findCharity(slug: string): Charity | undefined {
  return CHARITIES.find((c) => c.slug === slug);
}

export function generateStaticParams() {
  return CHARITIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const charity = findCharity(slug);
  if (!charity) {
    return { title: 'Charity not found | World Cup 2026' };
  }
  return {
    title: `${charity.name} | Charities | World Cup 2026`,
    description: charity.tagline,
  };
}

export default async function CharityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const charity = findCharity(slug);
  const content = CHARITY_CONTENT[slug];
  if (!charity || !content) {
    notFound();
  }

  return (
    <PageLayout>
      <div className="py-4">
        <Link
          href="/charities"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Charities
        </Link>
      </div>

      <section className="py-8 text-center md:py-12">
        <div className="border-border mx-auto mb-6 flex h-40 w-full max-w-md items-center justify-center rounded-lg border bg-white p-6">
          <Image
            src={charity.logo}
            alt={`${charity.name} logo`}
            width={320}
            height={128}
            className="max-h-32 w-auto object-contain"
            priority
          />
        </div>
        <h1 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">{charity.name}</h1>
        <Button asChild variant="outline">
          <a href={charity.url} target="_blank" rel="noopener noreferrer">
            Visit {charity.displayUrl}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </section>

      <section className="pb-16">
        <div className="text-muted-foreground mx-auto max-w-3xl space-y-4 text-base leading-relaxed">
          {content.paragraphs.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          {content.signature && (
            <p className="text-foreground pt-2 font-medium">{content.signature}</p>
          )}
        </div>
      </section>
    </PageLayout>
  );
}
