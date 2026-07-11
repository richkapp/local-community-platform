export const communityConfig = {
  name: 'Braga AI Builders',
  city: 'Braga',
  whatsappUrl: 'https://chat.whatsapp.com/GwhqmjtwcPT4vVmQmqqIRW',
  memberInviteCode: 'braga-group-988401a9f0d147dfa68b5c7a16e683d3d0569c18',
  githubUrl: 'https://github.com/0rderfl0w/braga-ai-builders'
} as const;

export const memberInvitePath = `/join/${communityConfig.memberInviteCode}`;
export const communityPageTitle = (page?: string) => page ? `${page} · ${communityConfig.name}` : communityConfig.name;
