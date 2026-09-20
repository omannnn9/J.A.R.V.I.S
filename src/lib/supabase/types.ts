export interface Profile {
  id: string;
  email: string | null;
  display_name: string;
  assistant_name: string;
  theme_hue: number;
  voice_name: string;
  gemini_api_key: string | null;
  // Stored by device *label*, not id — device ids are unstable across
  // browser restarts and hot-plugs, labels survive them. Resolved back to
  // a live deviceId at connect time, falling back to the system default
  // when the saved device is no longer present.
  mic_device_label: string | null;
  speaker_device_label: string | null;
  onboarded: boolean;
  created_at: string;
  updated_at: string;
}

export interface Memory {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  text: string;
  remind_at: string;
  notified: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface WatchTopic {
  id: string;
  user_id: string;
  topic: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
      };
      memories: {
        Row: Memory;
        Insert: Partial<Memory> & { user_id: string; content: string };
        Update: Partial<Memory>;
      };
      reminders: {
        Row: Reminder;
        Insert: Partial<Reminder> & { user_id: string; text: string; remind_at: string };
        Update: Partial<Reminder>;
      };
      messages: {
        Row: Message;
        Insert: Partial<Message> & { user_id: string; role: Message["role"]; content: string };
        Update: Partial<Message>;
      };
      watch_topics: {
        Row: WatchTopic;
        Insert: Partial<WatchTopic> & { user_id: string; topic: string };
        Update: Partial<WatchTopic>;
      };
    };
  };
}
