import { useCallback, useEffect, useRef, useState } from 'react';
import { listPostTags } from '@/lib/ideas';
import { toUserMessage } from '@/lib/errors';
import { RIP_TAGS } from '@/lib/rips';
import type { PostTagCatalogItem } from '@/lib/types';

const fallbackTags: PostTagCatalogItem[] = RIP_TAGS.map((tag) => ({
  slug: tag.value,
  label: tag.label,
  usage_count: 0,
  is_system: true,
  viewer_created: false,
  viewer_custom_tag_count: 0,
  viewer_custom_tag_limit: 3,
  viewer_is_active: false
}));

export function usePostTagCatalog() {
  const [tags, setTags] = useState<PostTagCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    setError('');
    try {
      const rows = await listPostTags();
      if (current === sequence.current) setTags(rows);
    } catch (caught) {
      if (current === sequence.current) {
        setTags((existing) => existing.length > 0 ? existing : fallbackTags);
        setError(toUserMessage('tag-list', caught));
      }
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handleChange = () => void refresh();
    window.addEventListener('community:tags-changed', handleChange);
    return () => {
      sequence.current += 1;
      window.removeEventListener('community:tags-changed', handleChange);
    };
  }, [refresh]);

  return { tags, loading, error, refresh };
}
