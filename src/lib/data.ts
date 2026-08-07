export const VENUES = {
  arnoldHouse: {
    id: "arnold-house",
    name: "The Arnold House at Rugby",
    address: "Elsee Road, Rugby CV21 3BA",
    addressLines: ["Elsee Road", "Rugby", "CV21 3BA", "United Kingdom"],
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=The+Arnold+House+Elsee+Road+Rugby+CV21+3BA",
  },
  biltonJunior: {
    id: "bilton-junior",
    name: "Bilton Church of England Junior School",
    address: "Plantagenet Drive, Rugby CV22 6LB",
    addressLines: ["Plantagenet Drive", "Rugby", "CV22 6LB", "United Kingdom"],
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Bilton+Church+of+England+Junior+School+Plantagenet+Drive+Rugby",
  },
} as const;

export const SITE = {
  name: "Boots N Boogie",
  tagline: "Kick up your heels",
  description:
    "High-energy line dancing classes, socials, and step-by-step lessons for all levels across the Midlands. Ultra beginner to improver.",
  location: "Rugby, Warwickshire",
  venue: VENUES.arnoldHouse.name,
  address: [...VENUES.arnoldHouse.addressLines],
  addressShort: VENUES.arnoldHouse.address,
  mapsUrl: VENUES.arnoldHouse.mapsUrl,
  facebook: "https://www.facebook.com/profile.php?id=61578353262549",
  tiktok: "https://www.tiktok.com/@boots.n.boogie",
  email: "hello@bootsnboogielinedancing.co.uk",
  classPrice: 10,
};

export const NAV = [
  { label: "Home", href: "/" },
  { label: "Classes", href: "/classes/" },
  { label: "Book", href: "/book/" },
  { label: "Events", href: "/events/" },
  { label: "Community", href: "/community/" },
  { label: "Blog", href: "/blog/" },
  { label: "Shop", href: "/shop/" },
  { label: "Subscribe", href: "/subscribe/" },
  { label: "Franchise", href: "/franchise/" },
  { label: "About", href: "/about/" },
  { label: "Contact", href: "/contact/" },
];

export const SUBSCRIPTION_PLAN = {
  id: "monthly_social",
  name: "Boots N Boogie Social Membership",
  amountGbp: 40,
  interval: "month" as const,
  currency: "GBP",
  freeSessionsPerWeek: 1,
  benefits: [
    "1 free class session every week (worth £10)",
    "Free entry to the quarterly line dance social",
    "Bring a +1 for free (first-timer guests welcome)",
    "Subscriber community chat (announcements + general chat)",
    "Cancel any time — no long lock-in",
  ],
  description:
    "£40 per month by UK Direct Debit. Includes one free class every week, free entry to every quarterly social, a free +1, and access to the member community chat — cancel whenever you like.",
};

/** Franchise commercial model — HQ-friendly, still viable for operators */
export const FRANCHISE = {
  name: "Boots N Boogie Franchise",
  tagline: "Bring the Boots N Boogie community to your town",
  upfrontFeeGbp: 9950,
  trainingFeeGbp: 0, // included in upfront
  royaltyPercent: 10,
  brandFundPercent: 2,
  /** Share of franchisee merch gross revenue — never royalty-free */
  merchRoyaltyPercent: 15,
  exclusiveRadiusMiles: 12,
  supportMonths: 3,
  includes: [
    "Exclusive UK territory (typically 12-mile radius / agreed postcode cluster)",
    "Full progressive curriculum: ultra beginner → higher beginner → improver",
    "Class plans, music guidance, social event playbook & ops manual",
    "Complete branding pack: logo licence, social templates, flyers, signage guides",
    "Merch programme: wholesale access to BnB tees, hoodies, totes + size/stock playbook",
    "15% royalty on merch sales (branded product is never royalty-free)",
    "Full operational support: bookings, memberships, socials, +1 tracking processes",
    "4-day launch training at Rugby HQ (or hybrid) for lead instructors",
    "Speaker system included — with full setup & sound training during the 4-day Rugby course",
    "Free 4-night Airbnb stay while you train in Rugby (franchise pack)",
    "HQ-led social media marketing to recruit dancers in your area (within an agreed launch budget — strong track record)",
    "You can still run your own local marketing on top of what we deliver",
    "90 days of founder support calls after launch, then ongoing brand support",
    "Launch marketing checklist and grand-opening social toolkit",
  ],
  investmentNotes: [
    "Upfront franchise fee: £9,950 (one-off) — territory, curriculum, speaker kit, 4-night Rugby stay & training included",
    "Ongoing royalty: 10% of gross class, membership and social ticket revenue",
    "Merch royalty: 15% of gross branded merchandise sales (never waived)",
    "Brand & marketing fund: 2% of dance revenue (national campaigns, assets & area social ads support)",
    "Launch social media acquisition: we run targeted campaigns for your town up to an agreed budget",
    "Typical extra local costs (venue deposit, insurance, top-up promo): £1,500–£4,000",
  ],
  whyFigures:
    "At £40 memberships and £10 drop-ins, a healthy town studio can break even on the licence fee within the first season. HQ takes 12% on dance revenue plus 15% on merch — curriculum, brand, speakers, training stay and marketing included.",
};

/** Seed admin — change password after first login in production use */
export const SEED_ADMIN = {
  email: "admin@bootsnboogie.local",
  name: "Studio Admin",
  password: "BnB-Admin-2026!",
  role: "admin" as const,
};

/** dayOfWeek: 0=Sun … 1=Mon … 4=Thu … 5=Fri … 6=Sat */
export type ClassSlot = {
  dayOfWeek: number;
  time: string;
  endTime: string;
  venueId: keyof typeof VENUES;
};

export const CLASSES = [
  {
    id: "ultra-beginner",
    title: "Beginner Line Dance",
    badge: "New",
    duration: "1 hr 30 min",
    price: SITE.classPrice,
    level: "Beginner",
    description:
      "Brand new to line dancing? This is your home. We break every dance into simple, repeatable steps — no experience, rhythm, or partner required.",
    highlights: ["No partner needed", "Steps taught from scratch", "Friendly vibe", "Perfect first class"],
    image: "/images/class-beginner.jpg",
    slots: [
      {
        dayOfWeek: 4, // Thursday
        time: "19:00",
        endTime: "20:30",
        venueId: "biltonJunior" as const,
      },
    ] satisfies ClassSlot[],
  },
  {
    id: "higher-beginner",
    title: "Higher Beginner Line Dance",
    badge: null as string | null,
    duration: "1 hr 30 min",
    price: SITE.classPrice,
    level: "Higher Beginner",
    description:
      "You’ve got the basics — now build confidence, timing, and flow with more patterns while keeping the energy high.",
    highlights: ["Build on foundations", "More patterns & turns", "Lots of guidance", "Great next step"],
    image: "/images/class-higher.jpg",
    slots: [
      {
        dayOfWeek: 1, // Monday
        time: "19:15",
        endTime: "20:45",
        venueId: "arnoldHouse" as const,
      },
      {
        dayOfWeek: 5, // Friday
        time: "10:00",
        endTime: "11:30",
        venueId: "arnoldHouse" as const,
      },
    ] satisfies ClassSlot[],
  },
  {
    id: "improver",
    title: "Improver Line Dance",
    badge: null as string | null,
    duration: "1 hr",
    price: SITE.classPrice,
    level: "Improver",
    description:
      "Level up with sharper technique and social-ready dances. Still all about fun — never perfection.",
    highlights: ["Sharper technique", "Faster progressions", "Social-ready dances", "Supportive coaching"],
    image: "/images/class-improver.png",
    slots: [
      {
        dayOfWeek: 1, // Monday
        time: "20:45",
        endTime: "21:45",
        venueId: "arnoldHouse" as const,
      },
    ] satisfies ClassSlot[],
  },
];

export const EVENTS = [
  {
    id: "little-buckaroos",
    title: "Little Buckaroos Summer Workshop",
    dateLabel: "23-07-2026 – 27-08-2026",
    dateISO: "2026-07-23",
    endDateISO: "2026-08-27",
    time: "10:00 – 11:00",
    doors: "Every Thursday during summer holidays",
    venue: SITE.venue,
    address: SITE.addressShort,
    image: "/images/event-buckaroos.jpg",
    status: "open" as const,
    isSocial: false,
    level: "Kids + Parents / Guardians",
    blurb:
      "Kids summer holiday workshop — Thursdays 10–11am for parents/guardians and children together.",
    details: [
      "Every Thursday 23-07-2026 – 27-08-2026",
      "10 AM – 11 AM at The Arnold House",
      "Parent/guardian + child sessions",
      "Full 6-week workshop booking",
    ],
    tickets: [
      { id: "lb-1", name: "1 child + 1 Adult", price: 60 },
      { id: "lb-2", name: "2 children + 1 Adult (15% off)", price: 111 },
      { id: "lb-3", name: "3 Children + 1 Adult (30% off)", price: 162 },
    ],
  },
  {
    id: "summer-social",
    title: "Summer Social Evening",
    dateLabel: "11-07-2026",
    dateISO: "2026-07-11",
    endDateISO: "2026-07-11",
    time: "19:00 – 23:30",
    doors: "Doors 7:00pm · Dancing from 7:30pm",
    venue: SITE.venue,
    address: SITE.addressShort,
    image: "/images/event-summer.jpg",
    status: "closed" as const,
    isSocial: true,
    level: "Absolute Beginner – Improver",
    blurb:
      "Boots ’N’ Boogie Summer Line Dance Social at The Arnold House. BBQ options, great music and atmosphere.",
    details: [
      "Absolute Beginner – Improver Level",
      "BBQ included in selected ticket types only",
      "Dancing from 7:30pm until late",
      "Subscribers enter free (see membership)",
    ],
    tickets: [
      { id: "ss-dnf", name: "Dancer No Food", price: 10 },
      { id: "ss-dbbq", name: "Dancing Including BBQ", price: 15 },
      { id: "ss-snf", name: "Spectator No Food", price: 2.5 },
      { id: "ss-sbbq", name: "Spectator Including BBQ", price: 7.5 },
    ],
  },
  {
    id: "spring-social",
    title: "Spring Line Dance Social Event",
    dateLabel: "16-05-2026",
    dateISO: "2026-05-16",
    endDateISO: "2026-05-16",
    time: "19:30 – 23:50",
    doors: "Line Dance Party!",
    venue: SITE.venue,
    address: SITE.addressShort,
    image: "/images/event-spring.jpg",
    status: "closed" as const,
    isSocial: true,
    level: "All levels",
    blurb:
      "Showcase dances you’ve learned in a lively party atmosphere with fellow dancers.",
    details: [
      "Dance all your favourite line dances",
      "Meet fellow dance enthusiasts",
      "Fun and friendly environment",
    ],
    tickets: [
      { id: "sp-dif", name: "Dancer including food", price: 15 },
      { id: "sp-def", name: "Dancer excluding food", price: 10 },
      { id: "sp-nif", name: "Non dancer including food", price: 7.5 },
      { id: "sp-nef", name: "Non dancer excluding food", price: 2.5 },
    ],
  },
  {
    id: "winter-social",
    title: "Winter Line Dance Social",
    dateLabel: "07-02-2026",
    dateISO: "2026-02-07",
    endDateISO: "2026-02-07",
    time: "19:30 – 23:50",
    doors: "Evening social",
    venue: SITE.venue,
    address: SITE.addressShort,
    image: "/images/event-winter.jpg",
    status: "closed" as const,
    isSocial: true,
    level: "All levels",
    blurb: "Our winter quarterly social — dance the night away at The Arnold House, Rugby.",
    details: ["Quarterly social night", "Beginner to improver welcome", "Community celebration"],
    tickets: [
      { id: "ws-d", name: "Dancer", price: 10 },
      { id: "ws-s", name: "Spectator", price: 2.5 },
    ],
  },
];

export const TEAM = [
  {
    name: "Jade",
    role: "Director & Lead Instructor",
    image: "/images/team-jade.jpg",
    bio: "Jade is Director of Boots N Boogie and leads the studio vision. She’s been kicking up her heels since she was a toddler — from the Birmingham Hippodrome and the West End to stages in Florida and Cyprus. She fills every class with music, laughter and confidence.",
  },
  {
    name: "Gemma",
    role: "Instructor",
    image: "/images/gemma-alt.jpg",
    bio: "Gemma has a deep passion for line dancing and has been dancing since her late teens. She spent years learning from some of the best line dancers in the business, alongside her husband Darren — Jade’s dad.",
  },
];

export const APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export const PRODUCTS = [
  {
    id: "midnight-boogie-tee",
    name: "Midnight Boogie T-Shirt",
    price: 15,
    image: "/images/shop-tshirt.jpg",
    description:
      "Soft, comfortable branded tee for the modern line dancer — on and off the floor. Midnight Boogie design.",
    category: "Apparel",
    sizes: [...APPAREL_SIZES],
    stock: { XS: 10, S: 20, M: 25, L: 25, XL: 15, XXL: 8 },
  },
  {
    id: "bnb-hoodie",
    name: "Boots N Boogie Hoodie",
    price: 25,
    image: "/images/shop-hoodie.jpg",
    description:
      "Made with a soft, comfortable fabric — perfect for staying cosy and looking cool on and off the dance floor. Signature branded design.",
    category: "Apparel",
    sizes: [...APPAREL_SIZES],
    stock: { XS: 5, S: 12, M: 18, L: 18, XL: 12, XXL: 6 },
  },
  {
    id: "boogie-boot-tote",
    name: "The Boogie Boot Tote Bag",
    price: 8,
    image: "/images/shop-tote.jpg",
    description: "Carry your shoes, water bottle and good vibes in our signature Boogie Boot tote.",
    category: "Accessories",
    sizes: ["One Size"],
    stock: { "One Size": 40 },
  },
];

export const STATS = [
  { num: "Rugby", label: "Home of our HQ studio" },
  { num: "50+", label: "Dancers in our community" },
  { num: "3", label: "Class levels for every step" },
  { num: "£10", label: "Per class drop-in" },
];

export const GALLERY = [
  "/images/gallery-1.jpg",
  "/images/gallery-2.jpg",
  "/images/gallery-5.jpg",
  "/images/gallery-6.jpg",
  "/images/social-crowd.jpg",
  "/images/gallery-8.jpg",
  "/images/gallery-4.jpg",
  "/images/gallery-7.jpg",
];

export const MISSION_QUOTE =
  "As a family of dancers, our aim was to create a space that’s truly unique — one that’s all about community, friendship and that family feeling. It’s amazing to see the friendships forming and how much our classes have grown. We’re grateful for every single person who comes along and has fun with us. We’re not here for perfection; all that matters is that you’re enjoying yourself and having a laugh.";

export const BLOG_POSTS = [
  {
    slug: "never-tried-line-dancing",
    title: "Never Tried Line Dancing? Here’s What To Expect At Your First Boots N Boogie Class",
    date: "2026-06-23",
    readMins: 2,
    image: "/images/blog-first-class.jpg",
    excerpt:
      "Thinking about trying line dancing but feeling a little nervous? Every single person in the room was a beginner once.",
    sections: [
      {
        title: "No Partner? No Problem!",
        body: "You do not need to bring a partner to line dancing. Most people come on their own! Line dancing is about dancing together as a group, learning the same steps and having fun. Before long you’ll be chatting, laughing and making new friends.",
      },
      {
        title: "Leave Your Nerves At The Door",
        body: "Everyone gets steps wrong sometimes. Line dancing isn’t about perfection — it’s about enjoying yourself. You’ll laugh, miss a turn, spin the wrong way once or twice and that’s part of the fun. Nobody is judging.",
      },
      {
        title: "We Teach You Step By Step",
        body: "We break dances into simple steps and teach them gradually. You don’t need experience, rhythm, or fancy moves. We’ll guide you, repeat sections when needed, and make sure everyone feels comfortable before the music starts.",
      },
      {
        title: "What Should I Wear?",
        body: "No need to rush out for cowboy boots (although we love them!). Wear comfortable clothes you can move in and shoes that feel good for dancing. Trainers, dance shoes or comfortable boots are fine. Cowboy hats optional… fun is compulsory!",
      },
      {
        title: "It’s More Than Dancing",
        body: "People often join to learn something new or get more active. They stay because of the atmosphere — great music, laughs, confidence, exercise and friendships in one place.",
      },
      {
        title: "Book Online & We’ll See You There",
        body: "Pick your level, choose a date, and book through the website. Members get one free class each week; everyone else is £10 drop-in. Arrive a few minutes early, say hello, and get ready to kick up your heels!",
      },
    ],
  },
  {
    slug: "cotton-eyed-joe",
    title: "The History and Impact of the Popular Line Dance Cotton Eyed Joe",
    date: "2026-02-21",
    readMins: 4,
    image: "/images/blog-cotton.jpg",
    excerpt:
      "Cotton Eyed Joe stands out as a timeless classic — and was the first dance we taught our new beginner class.",
    sections: [
      {
        title: "Origins of Cotton Eyed Joe",
        body: "Cotton Eyed Joe is a traditional American folk song with roots tracing back to the 19th century, believed to have emerged from the southern United States, particularly the Appalachian region. The catchy tune and rhythmic beat made it a natural fit for dancing.",
      },
      {
        title: "The Song’s Revival",
        body: "Cotton Eyed Joe gained renewed popularity in the 1990s when Rednex released a techno-country version, introducing the tune to a global audience and cementing it as a staple in line dancing playlists.",
      },
      {
        title: "Dance Steps and Style",
        body: "The line dance typically involves simple, repetitive steps: heel digs, step touches, turns and spins, claps and stomps. Accessible to beginners while allowing experienced dancers to add flair.",
      },
      {
        title: "At Boots N Boogie",
        body: "This was the first dance we taught our new beginner class. We posted a video on TikTok that has had a staggering 312.7K views and over 9,000 likes.",
      },
    ],
  },
  {
    slug: "memorable-2nd-social",
    title: "Memorable 2nd Line Dance Social with Live Singer Food and Fun",
    date: "2026-02-19",
    readMins: 2,
    image: "/images/blog-social.jpg",
    excerpt:
      "More than a recital — a real social party vibe with live vocals, food and friendships formed over shared steps.",
    sections: [
      {
        title: "More Than Just a Dance Class",
        body: "When we planned our quarterly socials, we wanted a space where dancers could truly dance the night away and show off what they’d mastered in class — a real social party vibe.",
      },
      {
        title: "The Magic of Our First Socials",
        body: "Our first social was electric — a sell-out night. As soon as we announced the second date, tickets flew off the virtual shelves again.",
      },
      {
        title: "What Makes These Nights Special",
        body: "Growth across our 50-strong mix of beginners and improvers, confidence lightbulb moments, and friendships forming over shared steps and missed beats.",
      },
      {
        title: "Live Music & Boot-Scootin’ Shots",
        body: "Jade’s partner Lee singing live changed everything. Cheeseburgers, fries, and Tequila Rose in cowboy boot glasses became the ultimate icebreaker.",
      },
    ],
  },
  {
    slug: "evolution-of-line-dancing",
    title: "The Evolution of Line Dancing: Merging Tradition with Modern Trends",
    date: "2026-02-18",
    readMins: 3,
    image: "/images/blog-evolution.png",
    excerpt:
      "Modern influences are reshaping line dancing — blending classic moves with new rhythms, styles and music.",
    sections: [
      {
        title: "The Roots of Line Dancing",
        body: "Line dancing originated as choreographed steps in lines or rows, with roots in European and American folk dances. It surged in popularity in the 1980s and 1990s with country music and film.",
      },
      {
        title: "Modern Influences",
        body: "Today’s line dancing embraces pop, hip-hop, Latin and electronic music. Choreographers fuse salsa, jazz and street dance. Online tutorials and challenges make it global.",
      },
      {
        title: "At Boots N Boogie",
        body: "Our improver class dances modern favourites like Ready For It (This Is It) by Evan VanScoyk (USA, September 2022) — tradition and modern tracks side by side.",
      },
    ],
  },
  {
    slug: "benefits-of-line-dancing",
    title: "Benefits of Choosing Line Dancing for Fun and Fitness",
    date: "2026-02-18",
    readMins: 3,
    image: "/images/blog-fitness.jpg",
    excerpt:
      "A unique blend of enjoyment and exercise — low-impact cardio, social connection and sharper minds.",
    sections: [
      {
        title: "Physical Health",
        body: "Line dancing is low-impact aerobic exercise that boosts cardiovascular health, balance, coordination, muscle tone, flexibility and endurance — accessible for beginners and those with physical limitations.",
      },
      {
        title: "Social Benefits",
        body: "Unlike solo workouts, line dancing happens in groups. At Boots N Boogie we encourage staying after class for social drinks, and after Friday morning class — coffee and cake each week.",
      },
      {
        title: "Mental Health & Cognition",
        body: "Following choreography sharpens focus and memory. Music, movement and social connection release endorphins and support emotional well-being.",
      },
      {
        title: "How to Get Started",
        body: "Book a Boots N Boogie beginner class, wear supportive shoes, start simple, practice regularly, and join a social when you’re ready. No partner required.",
      },
    ],
  },
];

export const FIRST_CLASS_GUIDE = BLOG_POSTS[0];
