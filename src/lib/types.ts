export type Profile = {
  id: string;
  handle: string | null;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  role: 'member' | 'admin';
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type Idea = {
  id: string;
  slug: string;
  title: string;
  body: string;
  month_key: string;
  status: 'open' | 'selected' | 'closed' | 'hidden';
  author_id: string;
  created_at: string;
  updated_at: string;
  profiles?: Pick<Profile, 'handle' | 'display_name' | 'avatar_url'> | null;
  idea_vote_counts?: { upvote_count: number }[] | null;
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
  capacity: number | null;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  created_at: string;
  updated_at: string;
  event_registration_counts?: { registration_count: number }[] | null;
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
