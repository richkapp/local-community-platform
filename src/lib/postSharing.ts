export type PostShareOutcome = 'shared' | 'copied' | 'cancelled';

type ShareClient = {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText: (value: string) => Promise<void> };
};

type PostShareInput = {
  client: ShareClient;
  origin: string;
  slug: string;
};

export function buildPostShareData(origin: string, slug: string): ShareData {
  return {
    url: new URL(`/posts/${slug}`, origin).toString()
  };
}

export async function sharePost({ client, origin, slug }: PostShareInput): Promise<PostShareOutcome> {
  const data = buildPostShareData(origin, slug);

  if (client.share) {
    try {
      await client.share(data);
      return 'shared';
    } catch (caught) {
      if (caught instanceof Error && caught.name === 'AbortError') return 'cancelled';
    }
  }

  if (!client.clipboard) throw new Error('Sharing is unavailable.');
  await client.clipboard.writeText(data.url ?? '');
  return 'copied';
}
