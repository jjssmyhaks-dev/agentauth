import { motion } from "framer-motion";
import { Calendar, Clock } from "lucide-react";
import PublicLayout from "@/components/PublicLayout";
import { useState, useEffect } from "react";

const posts = [
  { slug: "why-agent-auth", title: "Why Agent Auth Is Different From Human Auth", excerpt: "Traditional auth assumes a human typing a password. Agents don't log in — they act. Here's why that changes everything about identity infrastructure.", date: "2026-08-28", readTime: 5, tag: "Engineering" },
  { slug: "trust-scoring", title: "Dynamic Trust Scoring: Detecting Compromised Agents", excerpt: "A valid signed token doesn't mean the agent is behaving normally. How behavioral analysis catches what static auth misses.", date: "2026-08-26", readTime: 8, tag: "Security" },
  { slug: "approval-workflows", title: "Designing Effective Human-in-the-Loop Workflows", excerpt: "When should an agent wait for approval? When should it run autonomously? A practical framework for designing approval policies.", date: "2026-08-24", readTime: 6, tag: "Product" },
  { slug: "audit-trail", title: "Tamper-Evident Audit Trails: Hash Chains Explained", excerpt: "How AgentAuth uses SHA-256 hash chaining to create audit logs that are mathematically impossible to tamper with.", date: "2026-08-22", readTime: 7, tag: "Engineering" },
  { slug: "launch", title: "Introducing AgentAuth: Identity for the Agent Era", excerpt: "We're launching AgentAuth — purpose-built identity, permissions, and audit infrastructure for AI agents acting autonomously.", date: "2026-08-20", readTime: 3, tag: "Announcement" },
];

function ReadingTime({ minutes }: { minutes: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (display < minutes) {
      const t = setTimeout(() => setDisplay((d) => d + 1), 100);
      return () => clearTimeout(t);
    }
  }, [display, minutes]);
  return <span>{display} min read</span>;
}

export default function BlogPage() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="eyebrow mb-4">Blog</div>
          <h1 className="text-3xl sm:text-4xl">Insights on agent identity & security.</h1>
        </motion.div>

        <div className="mt-12 space-y-0">
          {posts.map((post, i) => (
            <motion.article
              key={post.slug}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.06 }}
              className="border-t border-dashed border-hairline py-8 first:border-t-0 group cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{post.tag}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <ReadingTime minutes={post.readTime} />
                </span>
              </div>
              <h2 className="text-xl font-medium group-hover:underline">{post.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{post.excerpt}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
