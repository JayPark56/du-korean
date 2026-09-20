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

/** One lesson request per student per week (week_start = Monday, Denver calendar). */
export type TopicRequest = {
  id: string;
  user_id: string;
  week_start: string;
  main_topic: string;
  additional_details: string;
  updated_at: string;
  /** When the admin ticked it as read; null = unread. */
  read_at: string | null;
};

/** A lesson the admin confirmed ("픽스") for a specific slot. */
export type FixedLesson = {
  id: string;
  week_start: string;
  day: string;
  start_time: string;
  end_time: string;
  student_ids: string[];
  note: string;
  created_at: string;
};

export type AdminSeenArea = "schedule" | "requests";

export type AdminSeen = {
  admin_id: string;
  area: AdminSeenArea;
  seen_at: string;
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
        Insert: Pick<TopicRequest, "user_id" | "week_start" | "main_topic"> &
          Partial<Pick<TopicRequest, "id" | "additional_details" | "updated_at">>;
        Update: Partial<Pick<TopicRequest, "main_topic" | "additional_details">>;
        Relationships: [];
      };
      fixed_lessons: {
        Row: FixedLesson;
        Insert: Pick<FixedLesson, "week_start" | "day" | "start_time" | "end_time" | "student_ids"> &
          Partial<Pick<FixedLesson, "id" | "note" | "created_at">>;
        Update: Partial<Pick<FixedLesson, "student_ids" | "note">>;
        Relationships: [];
      };
      admin_seen: {
        Row: AdminSeen;
        Insert: never; // written through mark_admin_seen()
        Update: never;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: { uid?: string }; Returns: boolean };
      mark_admin_seen: { Args: { seen_area: AdminSeenArea }; Returns: undefined };
      set_request_read: { Args: { request_id: string; is_read: boolean }; Returns: undefined };
      delete_student: { Args: { student_id: string }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
