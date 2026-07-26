import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { BLOG_POSTS } from "@/lib/data";
import { formatDateUK } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Blog",
  description: "News, guides and stories from Boots N Boogie line dancing in Rugby.",
};

export default function BlogIndexPage() {
  return (
    <>
      <PageHero
        label="Blog"
        title="Stories from the floor"
        description="First-class guides, dance history, social recaps and fitness benefits — all from the Boots N Boogie team."
      />
      <section className="py-16">
        <div className="container-page grid gap-6 md:grid-cols-2">
          {BLOG_POSTS.map((post, i) => (
            <Reveal key={post.slug} delay={i * 0.05}>
              <Link
                href={`/blog/${post.slug}/`}
                className="card-surface group flex h-full flex-col overflow-hidden transition hover:-translate-y-1 hover:border-accent/30"
              >
                <div className="relative aspect-[16/10]">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                    {formatDateUK(post.date)} · {post.readMins} min read
                  </p>
                  <h2 className="mt-2 font-display text-2xl tracking-wide leading-tight">
                    {post.title}
                  </h2>
                  <p className="mt-3 flex-1 text-sm text-muted">{post.excerpt}</p>
                  <span className="mt-4 text-sm font-bold text-cream group-hover:text-accent">
                    Read article →
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
