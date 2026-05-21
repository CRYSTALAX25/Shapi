// Lightweight blog content store. Posts are authored here (founder voice) and
// rendered by /blog (index) and /blog/[slug] (post). No CMS yet — add a post by
// appending to this array.

export type BlogPost = {
  slug: string
  title: string
  excerpt: string
  date: string          // ISO
  readMinutes: number
  accent: '#06B6D4' | '#7C3AED' | '#F43F5E'
  tag: string
  // Body is an array of paragraphs; a string starting with "## " renders as a subheading.
  body: string[]
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'cv-is-lying',
    title: 'Your CV is lying to everyone — and everyone knows it',
    excerpt:
      'Polished bullet points have become a genre of fiction. The fix isn’t a better template — it’s proof.',
    date: '2026-05-21',
    readMinutes: 3,
    accent: '#06B6D4',
    tag: 'Verification',
    body: [
      'Every CV is a marketing document. We all write them the same way: round the numbers up, claim the team win as a personal one, drop the projects that didn’t land. Recruiters know this, so they discount everything by 30%. Candidates know recruiters discount, so they inflate more. It’s an honesty arms race nobody wins.',
      'The result is a market where the loudest CV beats the most capable person. That’s bad for candidates who can actually do the work, and expensive for companies who hire the wrong one.',
      '## Proof beats polish',
      'Shapi takes the opposite approach. Instead of helping you write a shinier CV, we verify what’s real: we contact references independently — you don’t choose what they say — and cross-check their answers against your claims. What survives that process is worth more than any bullet point.',
      'When a hiring manager sees “$40M saved, confirmed by two independent referees,” that’s not a claim anymore. It’s evidence. And evidence is the only thing that ends the arms race.',
      'Your skills are real. Let’s make them provable.',
    ],
  },
  {
    slug: 'reference-check-is-broken',
    title: 'The reference check is broken. Here’s how we fixed it.',
    excerpt:
      'When the candidate hands you the referees, you’re not checking references — you’re reading a testimonial.',
    date: '2026-05-18',
    readMinutes: 4,
    accent: '#7C3AED',
    tag: 'Trust',
    body: [
      'Here’s how reference checks usually work: the candidate gives you three names. Those three people are, unsurprisingly, the three people most likely to say something glowing. You call them, they say glowing things, you tick the box.',
      'That’s not verification. That’s a curated testimonial reel. The whole point of a reference — an outside view of how someone actually works — is lost the moment the candidate controls who you talk to.',
      '## Independent sourcing changes everything',
      'Shapi sources references the way a journalist would: we decide who to contact based on your real work history, reach out ourselves, and keep what each person says confidential from you. You never see who said what, and you can’t pre-coach the answers.',
      'Then our AI reads across all of them at once. Where three referees independently mention the same strength, that’s a verified signal. Where two disagree, we surface it honestly rather than hide it — because an honest flag is more credible than a suspiciously perfect record.',
      'The output is a single cross-checked report that travels with the candidate. One verification, reused everywhere — instead of every employer redoing the same broken phone calls.',
    ],
  },
  {
    slug: 'ai-is-eating-jobs',
    title: 'AI is eating jobs. Your skills are still real.',
    excerpt:
      'Degrees are becoming optional and roles are disappearing. The people underneath them are not.',
    date: '2026-05-14',
    readMinutes: 4,
    accent: '#F43F5E',
    tag: 'The future of work',
    body: [
      'AI is automating tasks that employed millions. Four-year degrees are becoming optional. The most in-demand roles on the planet didn’t exist five years ago. If you feel the ground shifting, you’re not imagining it.',
      'Most platforms respond to this by adding more filters — more ways to screen people out, faster. We think that’s exactly backwards.',
      '## Skills don’t disappear when job titles do',
      'A construction supervisor in Dubai has judgment no algorithm has captured. An operations director leaving a giga-project has achievements no CV template was built to hold. When the title vanishes, the capability underneath it doesn’t.',
      'Shapi’s job is to capture that capability — through conversation, evidence, and verification — and then show you where it transfers next. If AI is coming for your role, we map your transferable skills and point you at the roles and the upskilling that get you there.',
      'You are not your job title. Your future is yours to shape. We just make sure the right people see what you can really do.',
    ],
  },
]

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find(p => p.slug === slug)
}
