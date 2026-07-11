export type Profile = {
  id: string;
  handle: string | null;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  x_url: string | null;
  role: 'member' | 'admin';
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type PublicProfile = Pick<
  Profile,
  'handle' | 'display_name' | 'bio' | 'avatar_url' | 'website_url' | 'linkedin_url' | 'github_url' | 'x_url'
>;

export type EditableProfile = Pick<
  Profile,
  'handle' | 'display_name' | 'bio' | 'avatar_url' | 'website_url' | 'linkedin_url' | 'github_url' | 'x_url' | 'is_public'
>;

export type RipCategory = 'idea' | 'resource' | 'perspective';
export type RipTag = 'next-event' | 'news' | 'community-challenge' | 'collaboration' | 'learning' | 'member-project';

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
  profiles?: PublicProfile | null;
  upvote_count?: number;
  viewer_has_voted?: boolean;
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
