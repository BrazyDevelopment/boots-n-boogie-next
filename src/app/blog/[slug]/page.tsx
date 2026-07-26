import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_POSTS } from "@/lib/data";
import { formatDateUK } from "@/lib/dates";

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  return {
    title: post?.title,
    description: post?.excerpt,
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) notFound();

  const others = BLOG_POSTS.filter((p) => p.slug !== slug).slice(0, 3);

  return (
    <article>
      <section className="relative min-h-[40vh] overflow-hidden pt-20">
        <Image src={post.image} alt="" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-bg/50" />
        <div className="container-page relative flex min-h-[40vh] flex-col justify-end pb-12 pt-28">
          <Link href="/blog/" className="text-sm font-semibold text-accent">
            ← All posts
          </Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-accent">
            {formatDateUK(post.date)} · {post.readMins} min read
          </p>
          <h1 className="mt-3 max-w-4xl font-display text-3xl tracking-wide md:text-5xl">
            {post.title}
          </h1>
        </div>
      </section>

      <section className="py-14">
        <div className="container-page max-w-3xl">
          <p className="text-lg text-muted">{post.excerpt}</p>
          <div className="prose-bnb mt-10">
            {post.sections.map((s) => (
              <div key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap gap-3">
            <Link href="/book/" className="btn-primary">
              Book a class
            </Link>
            <Link href="/blog/" className="btn-secondary">
              More posts
            </Link>
          </div>
        </div>
      </section>

      {others.length > 0 && (
        <section className="border-t border-line bg-bg-elevated py-14">
          <div className="container-page">
            <h2 className="font-display text-3xl tracking-wide">More from the blog</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {others.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}/`} className="card-surface p-5 hover:border-accent/30">
                  <h3 className="font-display text-xl tracking-wide leading-snug">{p.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{p.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
