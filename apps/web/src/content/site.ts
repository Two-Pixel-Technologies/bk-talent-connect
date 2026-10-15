/**
 * Public-site copy.
 *
 * All non-obvious business content lives here, not inline in JSX, so the next
 * public page follows the same pattern and BK's copy review has one file to
 * read per page.
 *
 * Stats, phone/WhatsApp numbers below are illustrative placeholder content
 * (clearly a demo dataset, not real production figures) standing in until BK
 * supplies real numbers — swap them out then. Nothing here claims a Phase 2
 * capability — AI matching, email/WhatsApp delivery — as live; the site
 * describes what the portal does today.
 */

import type { PublicIconKey, PublicSocialIconKey } from '../components/icons/public-icons.js';

export const home = {
  hero: {
    eyebrow: 'Trusted · Verified · Managed End-to-End',
    heading: [
      { text: 'Building careers.', accent: false },
      { text: 'Strengthening businesses.', accent: true },
    ],
    body: "BK Talent Connect brings together verified talent and hiring companies across India's industrial sectors. Every profile and every role is reviewed by our team before it goes live.",
    primaryCta: { label: "I'm a Candidate", to: '/register/candidate' },
    secondaryCta: { label: "I'm an Employer", to: '/register/employer' },
    chips: [
      { label: 'Verified Professionals', icon: 'shieldCheck' as PublicIconKey },
      { label: 'Dedicated Recruiters', icon: 'userCheck' as PublicIconKey },
      { label: 'Quality Placements', icon: 'award' as PublicIconKey },
      { label: 'Managed Process', icon: 'clipboardCheck' as PublicIconKey },
      { label: 'End-to-End Support', icon: 'lifeBuoy' as PublicIconKey },
    ],
  },

  stats: [
    { value: '2,400+', label: 'Verified Candidates', icon: 'userCheck' as PublicIconKey },
    { value: '180+', label: 'Trusted Employers', icon: 'briefcase' as PublicIconKey },
    { value: '650+', label: 'Successful Placements', icon: 'award' as PublicIconKey },
    { value: 'Under 3 Days', label: 'Target Shortlisting Time', icon: 'clock' as PublicIconKey },
  ],

  audiences: [
    {
      title: 'For Candidates',
      body: 'Build one profile. Our team reviews it, then puts you in front of employers hiring for your skills, including roles that are never advertised.',
      points: ['Verified job opportunities', 'Transparent, tracked process', 'Updates at every stage'],
      cta: { label: 'Start your journey', to: '/register/candidate' },
      icon: 'userCheck' as PublicIconKey,
    },
    {
      title: 'For Employers',
      body: 'Post a role with a confidential salary band. We verify every company, review every posting, and shortlist candidates ourselves before you spend time on them.',
      points: ['Pre-verified talent pool', 'Every profile screened by our team', 'Faster, focused shortlists'],
      cta: { label: 'Start hiring', to: '/register/employer' },
      icon: 'briefcase' as PublicIconKey,
    },
  ],

  howItWorksCandidate: {
    title: 'For Candidates',
    subtitle: 'Our verified process helps you find the right opportunity.',
    steps: [
      { title: 'Register', body: 'Create your account in a few minutes.', icon: 'userPlus' as PublicIconKey },
      { title: 'Complete Profile', body: 'Add skills, experience and preferences.', icon: 'fileCheck' as PublicIconKey },
      { title: 'Admin Review', body: 'We review your profile for quality.', icon: 'shieldCheck' as PublicIconKey },
      { title: 'Apply & Track', body: 'Apply to roles and follow every stage.', icon: 'send' as PublicIconKey },
    ],
  },

  howItWorksEmployer: {
    title: 'For Employers',
    subtitle: 'Post roles and connect with pre-verified talent.',
    steps: [
      { title: 'Register', body: 'Create your employer account.', icon: 'userPlus' as PublicIconKey },
      { title: 'Admin Approval', body: 'We verify your company and activate it.', icon: 'shieldCheck' as PublicIconKey },
      { title: 'Post a Job', body: 'Share your requirement with key details.', icon: 'briefcase' as PublicIconKey },
      { title: 'Review Candidates', body: 'See applicants once your posting is live.', icon: 'users' as PublicIconKey },
    ],
  },

  whyUs: [
    { title: 'Verified First', body: 'Every profile and company is carefully verified by our team.', icon: 'shieldCheck' as PublicIconKey },
    { title: 'Carefully Matched', body: 'Our recruiters review each profile against the role before it moves forward.', icon: 'target' as PublicIconKey },
    { title: 'Human Touch', body: 'Our team understands your needs and guides you at every step.', icon: 'users' as PublicIconKey },
    { title: 'Transparent', body: 'Clear updates and communication at every stage.', icon: 'eye' as PublicIconKey },
    { title: 'Faster Hiring', body: 'Reduce time-to-hire with quality, shortlisted profiles.', icon: 'zap' as PublicIconKey },
  ],

  industries: [
    { name: 'Engineering, Procurement & Construction', icon: 'factory' as PublicIconKey },
    { name: 'Pharmaceuticals & Life Sciences', icon: 'flask' as PublicIconKey },
    { name: 'Manufacturing & Machinery', icon: 'cog' as PublicIconKey },
    { name: 'Chemicals & Process', icon: 'droplet' as PublicIconKey },
    { name: 'Automation & Electronics', icon: 'cpu' as PublicIconKey },
    { name: 'Oil, Gas & Power', icon: 'zap' as PublicIconKey },
  ],

  approach: {
    heading: [
      { text: 'Careful review.', accent: false },
      { text: 'Human expertise.', accent: true },
      { text: 'Better matches.', accent: false },
    ],
    body: 'We combine deep sector knowledge with a disciplined review process to connect the right people with the right opportunities.',
    points: [
      'Recruiters with real industry insight',
      'Every profile personally reviewed for fit',
      'Continuous support and communication',
    ],
    pipelinePreview: [
      { name: 'Candidate profile', stage: 'Shortlisted', tone: 'green' as const },
      { name: 'Candidate profile', stage: 'Interview', tone: 'amber' as const },
      { name: 'Candidate profile', stage: 'Applied', tone: 'slate' as const },
    ],
  },

  contact: {
    heading: 'Have questions? We are here to help.',
    whatsapp: { label: 'Chat on WhatsApp', value: '+91 98765 43210', href: 'https://wa.me/919876543210', icon: 'whatsapp' as PublicIconKey },
    email: {
      label: 'Email Us',
      value: 'hello@bktalentconnect.com',
      href: 'mailto:hello@bktalentconnect.com',
      icon: 'mail' as PublicIconKey,
    },
    phone: { label: 'Call Us', value: '+91 22 4567 8900', href: 'tel:+912245678900', icon: 'phone' as PublicIconKey },
    linkedin: {
      label: 'Connect on LinkedIn',
      value: 'linkedin.com/company/bk-talent-connect',
      href: 'https://www.linkedin.com/company/bk-talent-connect',
      icon: 'linkedin' as PublicIconKey,
    },
  },
} as const;

export const forCandidates = {
  hero: {
    eyebrow: 'For Candidates',
    heading: [
      { text: 'Your career,', accent: false },
      { text: 'our priority.', accent: true },
    ],
    body: "BK Talent Connect connects verified talent with trusted employers across India's industrial sectors. Build one profile, get reviewed by our team, and take the next step in your career.",
    primaryCta: { label: 'Create Your Profile', to: '/register/candidate' },
    secondaryCta: { label: 'How It Works', to: '#how-it-works' },
  },

  whyChoose: [
    {
      title: 'Verified & Secure',
      body: 'Your data and privacy are always protected. Your salary details are never shared with employers.',
      icon: 'shieldCheck' as PublicIconKey,
    },
    {
      title: 'Right Opportunities',
      body: 'We match you against roles in your sector and skill set, including roles that are never advertised.',
      icon: 'target' as PublicIconKey,
    },
    {
      title: 'Expert Guidance',
      body: 'Our team reviews your profile and supports you at every step of your application.',
      icon: 'users' as PublicIconKey,
    },
  ],

  benefits: [
    {
      title: 'Verified Profile Review',
      body: 'Every profile is personally reviewed by our team before it goes live to employers.',
      icon: 'shieldCheck' as PublicIconKey,
    },
    {
      title: 'Application Tracking',
      body: "Follow every application's progress in real time, from Applied through to a decision.",
      icon: 'fileCheck' as PublicIconKey,
    },
    {
      title: 'In-App Notifications',
      body: 'Get notified the moment your status changes, right in your dashboard.',
      icon: 'bell' as PublicIconKey,
    },
    {
      title: 'Curated Recommendations',
      body: 'Our team can put your profile forward for roles you never applied to.',
      icon: 'award' as PublicIconKey,
    },
    {
      title: 'Private & Confidential',
      body: 'Your contact details and salary expectations stay private, always.',
      icon: 'lock' as PublicIconKey,
    },
    {
      title: 'Completely Free',
      body: 'There is no cost to candidates, ever. Focus on your career, not on fees.',
      icon: 'zap' as PublicIconKey,
    },
  ],

  faq: [
    {
      question: 'Is BK Talent Connect free for candidates?',
      answer: 'Yes. Creating a profile, applying to roles and tracking your applications is completely free.',
    },
    {
      question: 'How does profile verification work?',
      answer:
        'Once you submit your profile, our team reviews it for quality and completeness. You can browse and apply to roles as soon as it is approved.',
    },
    {
      question: 'Can I apply to multiple jobs?',
      answer: 'Yes. Apply to as many live roles as you like, and track each application separately from your dashboard.',
    },
    {
      question: 'Will employers see my profile before I apply?',
      answer:
        'No. Employers only see your profile for roles you apply to, or roles our team puts you forward for. Your salary details are never shared with employers.',
    },
    {
      question: 'How can I track my application status?',
      answer:
        "Your dashboard shows every application's stage: Applied, Under Review, Shortlisted, Interview and Decision. You're notified in the app the moment anything changes.",
    },
  ],

  finalCta: {
    heading: 'Ready to take the next step?',
    body: 'Create your profile and get discovered by verified employers.',
    primaryCta: { label: 'Create Your Profile', to: '/register/candidate' },
    secondaryCta: { label: 'Learn More', to: '#how-it-works' },
  },
} as const;

export const forEmployers = {
  hero: {
    eyebrow: 'For Employers',
    heading: [
      { text: 'The right talent.', accent: false },
      { text: 'Backed by expertise.', accent: true },
    ],
    body: "We help your business hire verified professionals through a transparent, expert-assisted recruitment process. Post a role with a confidential salary band, and we verify every company, review every posting, and shortlist candidates ourselves before you spend time on them.",
    primaryCta: { label: 'Register as Employer', to: '/register/employer' },
    secondaryCta: { label: 'How It Works', to: '#how-it-works' },
    orbit: [
      { label: 'Verified Talent Pool', icon: 'users' as PublicIconKey },
      { label: 'Expert Screening', icon: 'target' as PublicIconKey },
      { label: 'Quality Placements', icon: 'shieldCheck' as PublicIconKey },
      { label: 'Ongoing Support', icon: 'lifeBuoy' as PublicIconKey },
    ],
  },

  whyChoose: [
    {
      title: 'Verified Talent Pool',
      body: 'Access pre-verified, quality professionals across industrial sectors.',
      art: 'verifiedTalent' as const,
    },
    {
      title: 'Expert Screening',
      body: 'Our team screens and shortlists the most relevant profiles for your role.',
      art: 'screening' as const,
    },
    {
      title: 'Faster Hiring',
      body: 'Get well-matched candidates faster and reduce your time-to-hire.',
      art: 'growth' as const,
    },
  ],

  howItWorks: {
    title: 'How It Works: Employer Journey',
    steps: [
      { title: 'Register', body: 'Create your employer account in a few minutes.', icon: 'userPlus' as PublicIconKey },
      { title: 'Admin Approval', body: 'We verify your company and activate your account.', icon: 'shieldCheck' as PublicIconKey },
      { title: 'Post a Job', body: 'Share your requirements and a confidential salary band.', icon: 'briefcase' as PublicIconKey },
      { title: 'Review Candidates', body: 'See full profiles and resumes for every applicant.', icon: 'users' as PublicIconKey },
      { title: 'Hire the Right Talent', body: 'Interview, decide, and make a confident hire.', icon: 'award' as PublicIconKey },
    ],
  },

  whatYouCanDo: {
    heading: 'Everything you need to hire well',
    items: [
      {
        title: 'Manage Job Postings',
        body: 'Create and update your job postings; our team reviews each one before it goes live.',
        icon: 'briefcase' as PublicIconKey,
      },
      {
        title: 'Curated Shortlists',
        body: 'Our team can recommend well-matched candidates for your role, pinned to the top of your list.',
        icon: 'award' as PublicIconKey,
      },
      {
        title: 'Track Applications',
        body: 'Follow every applicant through your pipeline, from new through to a decision.',
        icon: 'fileCheck' as PublicIconKey,
      },
      {
        title: 'Shortlist & Interview',
        body: 'Move candidates forward and request interviews; our team coordinates scheduling with both sides.',
        icon: 'users' as PublicIconKey,
      },
      {
        title: 'Stay Informed',
        body: 'Get notified in-app the moment a candidate applies or an interview is confirmed.',
        icon: 'bell' as PublicIconKey,
      },
    ],
    dashboard: {
      counts: [
        { label: 'New', value: '12' },
        { label: 'Reviewing', value: '5' },
        { label: 'Interview', value: '3' },
        { label: 'Decision', value: '1' },
      ],
      rows: [
        { stage: 'New', tone: 'slate' as const },
        { stage: 'Shortlisted', tone: 'green' as const },
        { stage: 'Interview', tone: 'amber' as const },
      ],
    },
  },

  finalCta: {
    heading: 'Ready to build a stronger team?',
    body: 'Partner with us to find the right talent for your business.',
    primaryCta: { label: 'Register as Employer', to: '/register/employer' },
    secondaryCta: { label: 'Contact Us', to: '/#contact' },
  },
} as const;

export const aboutUs = {
  hero: {
    heading: [
      { text: 'People.', accent: false },
      { text: 'Purpose.', accent: false },
      { text: 'Partnership.', accent: true },
    ],
    body: 'BK Talent Connect is more than a recruitment platform. We are a managed hiring partner: every profile and every role is reviewed by our own team, not left to an algorithm.',
  },

  values: [
    {
      title: 'People First',
      body: 'We prioritize people at the center of everything we do.',
      icon: 'userCheck' as PublicIconKey,
    },
    {
      title: 'Honest & Transparent',
      body: 'Open conversations, real expectations, and no hidden agendas.',
      icon: 'eye' as PublicIconKey,
    },
    {
      title: 'Expert Advisory',
      body: 'Industry insight and hands-on guidance at every stage of hiring.',
      icon: 'target' as PublicIconKey,
    },
    {
      title: 'Long-Term Partners',
      body: 'We grow with our candidates and clients for the long run.',
      icon: 'lifeBuoy' as PublicIconKey,
    },
  ],

  story: {
    eyebrow: 'Our Story',
    heading: [
      { text: 'Built on experience.', accent: false },
      { text: 'Driven by values.', accent: true },
    ],
    body: "BK Talent Connect was founded on a simple belief: hiring in India's technical and industrial sectors deserves more than a job board. Our team works closely with every candidate and every employer, reviewing each profile and every posting by hand, so the people we bring together are genuinely the right fit.",
    stats: [
      { value: '8+', label: 'Years in Talent Advisory' },
      { value: '180+', label: 'Clients Served' },
      { value: '650+', label: 'Placements Done' },
    ],
  },

  approach: {
    eyebrow: 'Our Hiring Approach',
    heading: [
      { text: 'How we work,', accent: false },
      { text: 'step by step.', accent: true },
    ],
    body: 'Every profile and every role passes through our own team before it goes live, never left to an algorithm alone.',
    steps: [
      { title: 'Understand', body: 'We take time to understand every candidate’s goals and every employer’s requirement.', icon: 'target' as PublicIconKey },
      { title: 'Verify', body: 'Profiles and company postings are reviewed by our team for quality and accuracy.', icon: 'shieldCheck' as PublicIconKey },
      { title: 'Match', body: 'Recruiters assess genuine fit, not just keywords, before a profile moves forward.', icon: 'userCheck' as PublicIconKey },
      { title: 'Support', body: 'We stay involved through interviews, offers and beyond, for both sides.', icon: 'lifeBuoy' as PublicIconKey },
    ],
  },

  impact: {
    eyebrow: 'Our Impact',
    heading: 'Creating meaningful connections that build the future.',
  },

  finalCta: {
    heading: "Let's build what's next.",
    body: 'Whether you are hiring top talent or looking for the right opportunity, we are here to help.',
    primaryCta: { label: 'Register as Candidate', to: '/register/candidate' },
    secondaryCta: { label: 'Register as Employer', to: '/register/employer' },
  },
} as const;

export const contactPage = {
  hero: {
    eyebrow: 'Contact Us',
    heading: [
      { text: "Let's talk about", accent: false },
      { text: 'your next hire.', accent: true },
    ],
    body: 'Questions about a role, a candidate profile, or how BK Talent Connect works? Reach us directly or send an enquiry and our team will get back to you.',
    highlights: [
      { label: 'Replies within 1 business day', icon: 'clock' as PublicIconKey },
      { label: 'Real recruiters, not a bot', icon: 'userCheck' as PublicIconKey },
      { label: 'Confidential by default', icon: 'shieldCheck' as PublicIconKey },
    ],
  },

  helpStrip: {
    eyebrow: 'How We Can Help',
    heading: 'Tell us which best describes you',
    items: [
      {
        title: 'Candidates',
        body: 'Profile questions, application status, or advice on your next move.',
        icon: 'userCheck' as PublicIconKey,
      },
      {
        title: 'Employers',
        body: 'Job postings, hiring plans, or how our verified shortlisting works.',
        icon: 'briefcase' as PublicIconKey,
      },
      {
        title: 'General Enquiries',
        body: 'Partnerships, media, or anything else on your mind.',
        icon: 'chat' as PublicIconKey,
      },
    ],
  },

  cards: [
    { ...home.contact.whatsapp, title: 'WhatsApp', note: 'Fastest way to reach us', tag: 'Fastest response', featured: true },
    { ...home.contact.phone, title: 'Call Us', note: 'Mon–Sat, 9am–7pm IST' },
    { ...home.contact.email, title: 'Email Us', note: 'Replies within 1 business day' },
    { ...home.contact.linkedin, title: 'LinkedIn', note: 'Hiring news & company updates' },
  ],

  form: {
    eyebrow: 'Send an Enquiry',
    heading: 'Tell us what you need',
    body: "Fill in a few details and our team will respond within one business day.",
    roleOptions: [
      { value: 'CANDIDATE', label: "I'm a Candidate" },
      { value: 'EMPLOYER', label: "I'm an Employer" },
      { value: 'OTHER', label: 'Something Else' },
    ],
    submitLabel: 'Send Enquiry',
    successMessage: "Thanks, your message is in. Our team will get back to you within one business day.",
    errorMessage: "We could not send that just now. Please email us directly at hello@bktalentconnect.com and we'll take it from there.",
    steps: [
      { title: 'You reach out', body: 'Send an enquiry or message us directly on WhatsApp.' },
      { title: 'We review it', body: 'A member of our team reads every message personally.' },
      { title: 'We respond', body: "You'll hear back within one business day, guaranteed." },
    ],
  },

  finalCta: {
    heading: 'Prefer to get started right away?',
    primaryCta: { label: 'Register as Candidate', to: '/register/candidate' },
    secondaryCta: { label: 'Register as Employer', to: '/register/employer' },
  },
} as const;

export const publicNav = {
  logo: { title: 'BK Talent Connect', subtitle: 'Talent Recruitment Platform' },
  links: [
    { label: 'Home', href: '/' },
    { label: 'For Candidates', href: '/for-candidates' },
    { label: 'For Employers', href: '/for-employers' },
    { label: 'About Us', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
} as const;

export const publicFooter = {
  blurb:
    "A trusted recruitment platform connecting talent with opportunities across India's industrial sectors.",
  columns: [
    {
      title: 'Platform',
      links: [
        { label: 'For Candidates', href: '/for-candidates' },
        { label: 'For Employers', href: '/for-employers' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About Us', href: '/about' },
        { label: 'Contact', href: '/contact' },
        { label: 'Sign in', href: '/login' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy Policy', href: '/privacy-policy' },
        { label: 'Terms of Use', href: '/terms-of-use' },
      ],
    },
  ],
  social: [
    { label: 'LinkedIn', icon: 'linkedin' as PublicSocialIconKey, href: 'https://www.linkedin.com/company/bk-talent-connect' },
    { label: 'Facebook', icon: 'facebook' as PublicSocialIconKey, href: '#' },
    { label: 'Instagram', icon: 'instagram' as PublicSocialIconKey, href: '#' },
  ],
} as const;
