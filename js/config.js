/* Static configuration: ecosystem roles, flourishing areas, palettes, layout constants. */

export const ROLES = {
  hub:       {label:'Interdisciplinary Research to Impact Hub', c:{light:'#0D9488',dark:'#2DD4BF'},
              icon:'M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z',
              desc:'The convening center of the movement — multi-institution research programs anchoring the field.'},
  academic:  {label:'Academic Research',     c:{light:'#2563EB',dark:'#5EA0F6'},
              icon:'M12 4l10 5-10 5L2 9z M6 11v5c2 1.5 10 1.5 12 0v-5',
              desc:'Universities and research centers building the evidence base on AI, wellbeing, and flourishing.'},
  industry:  {label:'Industry Labs',         c:{light:'#7C3AED',dark:'#A78BFA'},
              icon:'M6 6h12v12H6z M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3',
              desc:'AI companies and labs studying — and shaping — how their systems affect the people who use them.'},
  civil:     {label:'Civil Society',         c:{light:'#059669',dark:'#34D399'},
              icon:'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6 M16 5a3 3 0 0 1 0 6 M17 14c2.5 0 5 2 5 6',
              desc:'Nonprofits and advocacy groups pushing technology toward the public interest.'},
  measure:   {label:'Measurement & Data',    c:{light:'#0891B2',dark:'#22D3EE'},
              icon:'M3 21h18 M6 21v-6 M12 21v-11 M18 21v-16',
              desc:'Organizations building the instruments — surveys, benchmarks, open data — that make flourishing measurable.'},
  funder:    {label:'Philanthropy',          c:{light:'#D97706',dark:'#FBBF24'},
              icon:'M2 6h20v12H2z M12 9a3 3 0 0 0 0 6 M6 12h.01 M18 12h.01',
              desc:'Foundations and funds financing a people-centered future for AI.'},
  policy:    {label:'Policy & Governance',   c:{light:'#64748B',dark:'#94A3B8'},
              icon:'M4 21h16 M12 3L4 9h16z M6 9v12M10 9v12M14 9v12M18 9v12',
              desc:'Institutes and intergovernmental bodies translating evidence into rules and norms.'},
  community: {label:'Community & Convening', c:{light:'#C026D3',dark:'#E879F9'},
              icon:'M4 5h16v10H9l-4 4V15H4z',
              desc:'Movements and platforms bringing practitioners and the public into the conversation.'},
};

export const AREAS = {
  agency:    {label:'Comprehension & Agency',              color:'#0EA5E9',
              desc:'Understanding AI and staying in control of it — transparency, autonomy, and the capacity to act on one’s own judgment.'},
  wellbeing: {label:'Physical & Mental Wellbeing',         color:'#10B981',
              desc:'AI that protects and strengthens bodily and psychological health rather than eroding it.'},
  learning:  {label:'Curiosity & Learning',                color:'#6366F1',
              desc:'Technology that deepens knowledge, skills, and the joy of finding things out.'},
  creativity:{label:'Creativity & Expression',             color:'#EC4899',
              desc:'AI that expands — rather than replaces — human imagination, authorship, and voice.'},
  purpose:   {label:'Sense of Purpose',                    color:'#F59E0B',
              desc:'Meaning, direction, and character — a life that feels worth living in an AI-shaped world.'},
  social:    {label:'Healthy Relationships & Social Lives',color:'#14B8A6',
              desc:'Human connection, community, and healthy discourse in the age of AI companions and feeds.'},
};
export const AREA_KEYS = Object.keys(AREAS);

export const PALETTES = {
  light:{bg:'#F7F9FA',dots:'#E9EFF0',edge:'#93A9AF',edgeSoft:'#BDCBCE',link:'#0D9488',
         ink:'#13272E',muted:'#63797F',labelBg:'rgba(247,249,250,.86)',ring:'#FFFFFF'},
  dark:{bg:'#0B1214',dots:'#162226',edge:'#52686E',edgeSoft:'#34464C',link:'#2DD4BF',
        ink:'#E9F2F3',muted:'#8FA5AB',labelBg:'rgba(11,18,20,.86)',ring:'#0B1214'},
};

export const LINK_TYPES = {
  fund:        { label: 'Fund',        color: '#D97706' },
  support:     { label: 'Support',     color: '#2563EB' },
  collaborate: { label: 'Collaborate', color: '#0D9488' },
};

export const SANS = '-apple-system,"SF Pro Text","Segoe UI",system-ui,sans-serif';
export const RING_R = 760, RING_W = 26;

export const PATHWAY = [
  {roles:['funder'],        title:'Philanthropy',       sub:'Capital fuels the field'},
  {roles:['hub','academic'],title:'Research',           sub:'Evidence & ideas'},
  {roles:['measure'],       title:'Measurement & Data', sub:'Benchmarks & metrics'},
  {roles:['civil'],         title:'Civil Society',      sub:'Advocacy & public interest'},
  {roles:['industry'],      title:'Companies & Labs',   sub:'Building & deployment'},
  {roles:['policy'],        title:'Policy & Governance',sub:'Rules & norms'},
  {roles:['community'],     title:'Community',          sub:'Movement & culture'},
];
