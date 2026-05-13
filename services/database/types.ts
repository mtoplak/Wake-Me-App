export type ChallengeType = 'qr' | 'object' | 'color' | 'steps' | 'voice';

export interface AlarmChallengeRecord {
  id: number;
  alarm_id: number;
  challenge_type: ChallengeType;
  difficulty: string;
  params: string | null;
}

export interface AlarmRecord {
  id: number;
  user_id: number | null;
  hour: number;
  minute: number;
  label: string;
  repeat_days: string;
  enabled: number;
  sound: string;
  vibration: number;
  created_at: string;
}

export type ChallengeParams = Partial<Record<ChallengeType, string>>;

export interface Alarm {
  id: number;
  hour: number;
  minute: number;
  label: string;
  repeatDays: string[];
  enabled: boolean;
  sound: string;
  vibration: boolean;
  challenges: ChallengeType[];
  challengeParams: ChallengeParams;
}

export interface AlarmInput {
  hour: number;
  minute: number;
  label: string;
  repeatDays: string[];
  enabled?: boolean;
  sound?: string;
  vibration?: boolean;
  challenges: ChallengeType[];
  challengeParams?: ChallengeParams;
}

export interface WakeStatRecord {
  id: number;
  alarm_id: number | null;
  date: string;
  wake_time: string;
  success: number;
  challenge_duration: number | null;
  challenge_type: string | null;
}

export interface WakeStat {
  id: number;
  date: string;
  wakeTime: string;
  success: boolean;
  challengeDuration: number | null;
  challengeType: ChallengeType | null;
}

export interface CachedQuote {
  id: number;
  text: string;
  author: string;
  date: string;
}

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  language: 'EN' | 'SL';
}
