import { supabase } from './supabase';

export const postParticipationSettingKeys = [
  'allow_anonymous_posts',
  'allow_signed_out_posts',
  'allow_anonymous_comments',
  'allow_anonymous_replies'
] as const;

export type PostParticipationSettingKey = typeof postParticipationSettingKeys[number];

export type PostParticipationSettings = {
  allow_anonymous_posts: boolean;
  allow_signed_out_posts: boolean;
  allow_anonymous_comments: boolean;
  allow_anonymous_replies: boolean;
};

export const lockedPostParticipationSettings: PostParticipationSettings = {
  allow_anonymous_posts: false,
  allow_signed_out_posts: false,
  allow_anonymous_comments: false,
  allow_anonymous_replies: false
};

export async function getPostParticipationSettings(): Promise<PostParticipationSettings> {
  const { data, error } = await supabase.rpc('get_post_participation_settings');
  if (error) throw error;
  const row = ((data ?? []) as PostParticipationSettings[])[0];
  if (!row) throw new Error('Post participation settings are unavailable.');
  return {
    allow_anonymous_posts: Boolean(row.allow_anonymous_posts),
    allow_signed_out_posts: Boolean(row.allow_signed_out_posts),
    allow_anonymous_comments: Boolean(row.allow_anonymous_comments),
    allow_anonymous_replies: Boolean(row.allow_anonymous_replies)
  };
}

export async function setPostParticipationSetting(key: PostParticipationSettingKey, enabled: boolean) {
  const { data, error } = await supabase.rpc('super_admin_set_post_participation_setting', {
    p_feature_key: key,
    p_enabled: enabled
  });
  if (error) throw error;
  return Boolean(data);
}
