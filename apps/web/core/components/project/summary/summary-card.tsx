/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { cn } from "@plane/utils";

type Props = {
  title: string;
  description: string;
  link?: { label: string; href: string };
  className?: string;
  children: React.ReactNode;
};

export function SummaryCard(props: Props) {
  const { title, description, link, className, children } = props;
  return (
    <section className={cn("flex min-w-0 flex-col rounded-lg border border-subtle bg-layer-1 p-5", className)}>
      <h3 className="text-16 font-semibold text-primary">{title}</h3>
      <p className="mt-0.5 text-13 text-tertiary">
        {description}
        {link && (
          <>
            {" "}
            <Link href={link.href} className="text-accent-primary hover:underline">
              {link.label}
            </Link>
          </>
        )}
      </p>
      <div className="mt-4 min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function SummaryEmpty({ message }: { message: string }) {
  return <p className="grid h-full min-h-24 place-items-center text-13 text-placeholder">{message}</p>;
}

/** Row that links to filtered work items when given an href. */
export function SummaryRowLink(props: { href?: string; className?: string; children: React.ReactNode }) {
  const { href, className, children } = props;
  if (!href) return <div className={cn("-mx-2 rounded-md px-2 py-1", className)}>{children}</div>;
  return (
    <Link href={href} className={cn("-mx-2 block rounded-md px-2 py-1 transition-colors hover:bg-layer-2", className)}>
      {children}
    </Link>
  );
}

/** Horizontal bar with a label, a count and its share of the total. */
export function ShareBar(props: {
  label: React.ReactNode;
  count: number;
  total: number;
  color?: string;
  href?: string;
}) {
  const { label, count, total, color, href } = props;
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <SummaryRowLink href={href} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3 text-13">
      <div className="min-w-0 truncate text-secondary">{label}</div>
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-layer-2">
          <div
            className="h-full rounded-full"
            style={{ width: `${percent}%`, backgroundColor: color ?? "var(--background-color-accent-primary)" }}
          />
        </div>
        <span className="w-16 shrink-0 text-right text-11 text-tertiary">
          {count} · {percent}%
        </span>
      </div>
    </SummaryRowLink>
  );
}
