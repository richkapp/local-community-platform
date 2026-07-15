export const communityConfig = {
  name: 'Braga AI Builders',
  city: 'Braga',
  locale: 'en-GB',
  timeZone: 'Europe/Lisbon',
  timeZoneLabel: 'Braga time',
  tagline: 'A local AI community',
  description: 'A Braga community for people actively using AI—from everyday ChatGPT users to advanced builders and everyone in between.',
  whatsappUrl: 'https://chat.whatsapp.com/GwhqmjtwcPT4vVmQmqqIRW',
  githubUrl: 'https://github.com/richkapp/local-community-platform',
  legal: {
    operatorName: 'Braga AI Builders community organizers',
    country: 'Portugal',
    governingLaw: 'Portuguese law',
    privacyFrameworkName: 'General Data Protection Regulation',
    privacyFrameworkShortName: 'GDPR',
    privacyFrameworkUrl: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng',
    dataProtectionAuthorityName: 'Comissão Nacional de Proteção de Dados (CNPD)',
    dataProtectionAuthorityUrl: 'https://www.cnpd.pt/cidadaos/participacoes/'
  },
  home: {
    eyebrow: 'A local AI community in Braga',
    heroTitle: 'Curious about AI? Come meet your people.',
    heroBody: 'Maybe you use ChatGPT instead of Google. Maybe a team of AI agents runs half your business. Most of us are somewhere in between. What connects us is simple: we use AI, we’re curious about where it’s going, and we want to learn from people nearby.',
    experienceRange: [
      'Replacing Google searches with ChatGPT',
      'Using AI to work smarter every day',
      'Building products, workflows, and automations',
      'Running a business with teams of AI agents'
    ],
    experienceFooter: 'If you actively use AI and want to understand it better, you belong here.',
    closingStatement: 'Different skills. Different interests. One shared habit: actively using AI and helping each other get better at it.'
  }
} as const;

export const communityPageTitle = (page?: string) => page ? `${page} · ${communityConfig.name}` : communityConfig.name;
