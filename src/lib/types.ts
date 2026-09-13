import type { Slot } from "./schedule";

export type Role = "student" | "admin";

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: Role;
  korean_level: string;
  goals: string;
  /** Storage object path in the "avatars" bucket, e.g. "<user id>/1726000000000.jpg". */
  avatar_url: string | null;
  bio: string;
  created_at: string;
};

export type AvailabilityRow = {
  id: string;
  user_id: string;
  week_start: string;
  available_slots: Slot[];
  updated_at: string;
};

export type TopicRequest = {
  id: string;
  user_id: string;
  content: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: Profile;
        Insert: never;
        Update: Partial<Pick<Profile, "name" | "korean_level" | "goals" | "avatar_url" | "bio">>;
        Relationships: [];
      };
      availability: {
        Row: AvailabilityRow;
        Insert: Pick<AvailabilityRow, "user_id" | "week_start" | "available_slots"> &
          Partial<Pick<AvailabilityRow, "id" | "updated_at">>;
        Update: Partial<Pick<AvailabilityRow, "available_slots">>;
        Relationships: [];
      };
      topic_requests: {
        Row: TopicRequest;
        Insert: Pick<TopicRequest, "user_id" | "content"> &
          Partial<Pick<TopicRequest, "id" | "updated_at">>;
        Update: Partial<Pick<TopicRequest, "content">>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: { uid?: string }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
