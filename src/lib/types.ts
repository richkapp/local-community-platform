export type Profile = {
  id: string;
  handle: string | null;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  avatar_path: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  x_url: string | null;
  role: 'member' | 'admin' | 'super_admin';
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type PublicProfile = Pick<
  Profile,
  'handle' | 'display_name' | 'bio' | 'avatar_url' | 'avatar_path' | 'website_url' | 'linkedin_url' | 'github_url' | 'x_url'
> & { avatar_updated_at: string | null };

export type EditableProfile = Pick<
  Profile,
  'handle' | 'display_name' | 'bio' | 'avatar_url' | 'avatar_path' | 'website_url' | 'linkedin_url' | 'github_url' | 'x_url' | 'is_public'
>;

export type EditableProfileRecord = EditableProfile & Pick<Profile, 'id' | 'updated_at'>;

export type RipCategory = 'idea' | 'resource' | 'perspective';
export type RipTag = string;

export type PostTagCatalogItem = {
  slug: RipTag;
  label: string;
  usage_count: number;
  is_system: boolean;
  viewer_created: boolean;
  viewer_custom_tag_count: number;
  viewer_custom_tag_limit: number;
  viewer_is_active: boolean;
};

export type Idea = {
  id: string;
  slug: string;
  title: string;
  body: string;
  category: RipCategory;
  tags: RipTag[];
  month_key: string;
  status: 'open' | 'selected' | 'closed' | 'hidden';
  created_at: string;
  updated_at: string;
  viewer_can_edit?: boolean;
  viewer_is_author?: boolean;
  viewer_has_bookmarked?: boolean;
  viewer_bookmarked_at?: string | null;
  profiles?: PublicProfile | null;
  upvote_count?: number;
  viewer_has_voted?: boolean;
  comment_count?: number;
};

export type PostComment = {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  is_anonymous: boolean;
  profiles: PublicProfile | null;
  upvote_count: number;
  viewer_has_upvoted: boolean;
};

export type Event = {
  id: string;
  slug: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  location_name: string | null;
  location_url: string | null;
  external_url: string | null;
  image_url: string | null;
  capacity: number | null;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  created_at: string;
  updated_at: string;
  registration_count?: number;
  viewer_registration_status?: Registration['status'] | null;
};

export type Registration = {
  id: string;
  event_id: string;
  user_id: string;
  status: 'registered' | 'waitlisted' | 'cancelled';
  note: string;
  created_at: string;
  updated_at: string;
};

export type VotingFeatureAccess = {
  is_enabled: boolean;
  viewer_is_admin: boolean;
};

export type CommunityVoteStatus = 'draft' | 'published' | 'closed';

export type CommunityVoteNamedVoter = {
  display_name: string;
};

export type CommunityVoteOption = {
  id: string;
  label: string;
  position: number;
  ballot_count: number;
  named_voters?: CommunityVoteNamedVoter[];
};

export type CommunityVote = {
  id: string;
  title: string;
  description: string;
  status: Exclude<CommunityVoteStatus, 'draft'>;
  closes_at: string;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  ballot_count: number;
  options: CommunityVoteOption[];
  viewer_option_id: string | null;
  viewer_is_anonymous: boolean | null;
  viewer_can_vote: boolean;
};

export type AdminCommunityVote = Omit<CommunityVote, 'status' | 'viewer_option_id' | 'viewer_is_anonymous' | 'viewer_can_vote'> & {
  status: CommunityVoteStatus;
  can_edit: boolean;
  can_delete: boolean;
};
