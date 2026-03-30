const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const QUALITY_STANDARDS = `
UNIVERSAL QUALITY STANDARDS (apply to every site regardless of niche):

HERO H1: specific result for client, NOT a job title.
  Good: "Back pain relief after the first session"
  Bad: "Quality massage services"

ABOUT: max 5 sentences + bullet facts with numbers.

SERVICES: outcome + duration + price per each service.
  Good: "Deep tissue massage — relieves chronic tension · 60 min · 800 UAH"

REVIEWS: generate 3 realistic ones — quote + name + age + specific result.

CTA: action button after every 1-2 sections. Form: max 3 fields.
Messengers: Telegram + Viber buttons.

DESIGN: minimalism, generous spacing (section padding min 80px),
single accent color, large headings (H1 min 48px desktop / 32px mobile),
mobile-first.

SEO (mandatory):
- Title: "[Service] [City] — [Name] | [UVP]"
- Meta description: 120-160 chars with keyword + CTA
- Single H1 with "[service] [city]"
- Schema.org LocalBusiness JSON-LD
- Google Maps iframe if address provided
- Open Graph tags
- No heavy libraries, lazy load images

TECHNICAL:
- Pure HTML5 + CSS3 + Vanilla JS
- Files: index.html + style.css + script.js
- IntersectionObserver for fade-in, smooth scroll
- Breakpoints: 768px, 1024px
`.trim();

const SITE_STRUCTURES = {
  landing: `
SITE TYPE: Landing page for a local specialist. Adapt ALL content to the specific niche.
SECTIONS: NAV (sticky) → HERO (H1=result) → ABOUT (photo+bullet facts) →
SERVICES (outcome+duration+price cards) → HOW IT WORKS (3-4 steps) →
REVIEWS (3 realistic) → CONTACT (form + messengers + map)
`.trim(),

  business_card: `
SITE TYPE: Personal portfolio / business card. Adapt to the specific profession.
SECTIONS: NAV → HERO (name+specialization+UVP) → ABOUT (story+approach) →
PORTFOLIO (image grid with descriptions) → SKILLS (tags) → CONTACT
`.trim(),

  menu: `
SITE TYPE: Online menu for food establishment. Adapt categories to the specific place.
SECTIONS: HEADER (name+hours+phone) → HERO (atmospheric) →
MENU (sticky category tabs + item cards: photo+name+description+weight+price) →
ABOUT (place story) → CONTACT (map+hours)
`.trim()
};

const SYSTEM_PROMPT = `
You are a Senior web developer at zvirycholeksandr.com.
Based on client data, generate a detailed technical prompt for Claude Code.

${QUALITY_STANDARDS}

OUTPUT (prompt text only, no explanations):

DEPLOY: /var/www/clients/{slug} → {slug}.zvirycholeksandr.com

DESIGN:
Colors: [niche-appropriate hex palette based on colorStyle]
Fonts: [2 Google Fonts appropriate for niche]

STRUCTURE:
[Every section with exact Ukrainian content, headings, CTAs, measurements]

SEO:
[title] [meta description] [Schema.org JSON-LD] [Open Graph]

TECHNICAL:
[File structure and requirements]
`.trim();

function buildSlug(name = '') {
  const map = {
    'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ye',
    'ж':'zh','з':'z','и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l',
    'м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
    'ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'',
    'ю':'yu','я':'ya',' ':'-'
  };
  return name.toLowerCase()
    .split('').map(c => map[c] ?? c).join('')
    .replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')
    .replace(/^-|-$/g, '').substring(0, 30);
}

async function generatePrompt(siteType, formData) {
  const slug = buildSlug(formData.name || formData.cafeName);
  const structure = SITE_STRUCTURES[siteType] || SITE_STRUCTURES.landing;

  const response = await client.chat.completions.create({
    model: 'gpt-3.5-turbo',
    max_tokens: 4000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${structure}\n\nCLIENT DATA:\nslug: ${slug}\n${
          Object.entries(formData).map(([k, v]) => `${k}: ${v}`).join('\n')
        }\n\nGenerate the complete Claude Code prompt. All text in Ukrainian.`
      }
    ]
  });

  return response.choices[0].message.content.trim();
}

module.exports = { generatePrompt };
