// User Types
export interface User {
  id: string;
  telegramId?: string;
  username?: string;
  email?: string;
  displayName: string;
  bio?: string;
  photoURL?: string;
  location?: Location;
  interests?: string[];
  language: 'en' | 'es';
  plan: SubscriptionPlan;
  planExpiry?: Date;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  country?: string;
}

// Subscription Types
export type SubscriptionPlan = 'free' | 'basic' | 'premium' | 'gold';

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  popular?: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'canceled' | 'expired' | 'past_due';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Payment Types
export interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  provider: 'epayco' | 'daimo';
  providerPaymentId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Live Stream Types
export interface LiveStream {
  id: string;
  title: string;
  description?: string;
  hostId: string;
  host: User;
  streamUrl: string;
  thumbnailUrl?: string;
  isActive: boolean;
  isPaid: boolean;
  price?: number;
  viewerCount: number;
  startedAt: Date;
  endedAt?: Date;
}

// Zoom Room Types
export interface ZoomRoom {
  id: string;
  name: string;
  hostId: string;
  host: User;
  meetingId: string;
  joinUrl: string;
  password?: string;
  isPublic: boolean;
  maxParticipants: number;
  duration: number;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  createdAt: Date;
}

// Radio Types
export interface RadioStation {
  id: string;
  name: string;
  streamUrl: string;
  nowPlaying?: NowPlaying;
  listeners: number;
  isLive: boolean;
}

export interface NowPlaying {
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  duration?: number;
  startedAt: Date;
}

export interface SongRequest {
  id: string;
  userId: string;
  user: User;
  songName: string;
  artist?: string;
  status: 'pending' | 'approved' | 'rejected' | 'played';
  requestedAt: Date;
  playedAt?: Date;
}

// Chat Types
export interface ChatMessage {
  id: string;
  userId: string;
  user: User;
  content: string;
  type: 'user' | 'assistant';
  createdAt: Date;
}

export interface ChatSession {
  id: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// Broadcast Types
export interface Broadcast {
  id: string;
  title: string;
  message: string;
  mediaUrl?: string;
  target: 'all' | 'premium' | 'free';
  scheduledFor?: Date;
  sentAt?: Date;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  recipientCount?: number;
  createdBy: string;
  createdAt: Date;
}

// Analytics Types
export interface Analytics {
  totalUsers: number;
  activeUsers: number;
  premiumUsers: number;
  totalRevenue: number;
  monthlyRevenue: number;
  activeStreams: number;
  totalStreams: number;
  radioListeners: number;
}

export interface UserGrowth {
  date: string;
  users: number;
  premiumUsers: number;
}

export interface RevenueData {
  date: string;
  revenue: number;
  subscriptions: number;
}

// Nearby User Types
export interface NearbyUser {
  user: User;
  distance: number;
}

// Creator Monetization Types
export interface Tip {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  message?: string;
  paymentId: string;
  createdAt: Date;
}

export interface CreatorStats {
  userId: string;
  totalEarnings: number;
  totalTips: number;
  totalSubscribers: number;
  monthlyEarnings: number;
  earningsHistory: RevenueData[];
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Form Types
export interface OnboardingData {
  language: 'en' | 'es';
  ageConfirmed: boolean;
  termsAccepted: boolean;
  email?: string;
}

export interface ProfileUpdateData {
  displayName?: string;
  bio?: string;
  location?: Location;
  interests?: string[];
  photoURL?: string;
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: Date;
}

// Settings Types
export interface UserSettings {
  userId: string;
  notifications: {
    email: boolean;
    telegram: boolean;
    broadcasts: boolean;
    tips: boolean;
  };
  privacy: {
    showLocation: boolean;
    showProfile: boolean;
    allowMessages: boolean;
  };
  language: 'en' | 'es';
  theme: 'light' | 'dark' | 'system';
}
