import React, { useState, useEffect } from 'react';
import { Mail, Bell, Share2, Check, AlertCircle, Zap, Users, MessageCircle, User, Lock, BarChart3 } from 'lucide-react';
import { api } from '../api/client';
import Layout from '../components/Layout';

export default function ComingSoonHangouts() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [waitlistCount, setWaitlistCount] = useState(3421);

  useEffect(() => {
    // Fetch actual waitlist count
    const fetchWaitlist = async () => {
      try {
        const res = await api.getComingSoonWaitlist('hangouts');
        if (res.count) setWaitlistCount(res.count);
      } catch (err) {
        // Use default count on error
      }
    };
    fetchWaitlist();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setSubmitStatus('error');
      setErrorMessage('Please enter a valid email');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);
    setErrorMessage('');

    try {
      const res = await api.signupComingSoonWaitlist('hangouts', { email });
      if (res.success) {
        setSubmitStatus('success');
        setEmail('');
        setTimeout(() => setSubmitStatus(null), 3000);
      } else {
        throw new Error(res.error || 'Signup failed');
      }
    } catch (err) {
      setSubmitStatus('error');
      setErrorMessage(err.message || 'Failed to signup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = (platform) => {
    const message = "👥 Meet the future of social hangouts on PNPtv! Video calls, virtual rooms, and community spaces coming soon. Join the waitlist: pnptv.app";
    const url = `${window.location.origin}/hangouts/coming-soon`;

    const shareLinks = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`,
      discord: `https://discord.com/oauth2/authorize?client_id=YOUR_DISCORD_BOT_ID`,
    };

    if (shareLinks[platform]) {
      window.open(shareLinks[platform], '_blank', 'width=600,height=400');
    }
  };

  return (
    <Layout>
      <div className="coming-soon-container">
        {/* Hero Section */}
        <section className="coming-soon-hero">
          <div className="coming-soon-hero-content">
            {/* Animated Badge */}
            <div className="coming-soon-badge pulse">
              <Users size={14} />
              <span>Community Awaits</span>
            </div>

            {/* Main Heading */}
            <h1 className="coming-soon-title">
              👥 Meet <span className="shimmer-text">Soon</span>
            </h1>

            {/* Subheading */}
            <p className="coming-soon-subtitle">
              Connect with your tribe in private spaces. Video calls, group chats, virtual rooms. Real community, zero barriers.
            </p>

            {/* Social Proof */}
            <div className="coming-soon-waitlist-badge">
              <Users size={16} />
              <span><strong>{waitlistCount.toLocaleString()}</strong> members waiting</span>
            </div>
          </div>

          {/* Animated Icons */}
          <div className="coming-soon-hero-icons">
            <div className="float-icon icon-1">
              <Users size={48} />
            </div>
            <div className="float-icon icon-2">
              <MessageCircle size={48} />
            </div>
            <div className="float-icon icon-3">
              <User size={48} />
            </div>
          </div>
        </section>

        {/* Signup Section */}
        <section className="coming-soon-signup-section">
          <div className="coming-soon-signup-box">
            <div className="coming-soon-signup-header">
              <h2>Reserve Your Spot</h2>
              <p>Get exclusive early access to Hangouts. Join our community pioneers.</p>
            </div>

            <form onSubmit={handleSubmit} className="coming-soon-form">
              <div className="coming-soon-input-group">
                <Mail size={18} className="coming-soon-input-icon" />
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="coming-soon-input"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="coming-soon-submit-btn"
                >
                  {isSubmitting ? (
                    <div className="spinner-sm"></div>
                  ) : (
                    <>
                      <Bell size={16} />
                      Notify Me
                    </>
                  )}
                </button>
              </div>

              {submitStatus === 'success' && (
                <div className="coming-soon-success-message">
                  <Check size={16} />
                  You're reserved! Check your email for updates.
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="coming-soon-error-message">
                  <AlertCircle size={16} />
                  {errorMessage}
                </div>
              )}
            </form>

            <div className="coming-soon-share-section">
              <p>Invite your friends</p>
              <div className="coming-soon-share-buttons">
                <button onClick={() => handleShare('twitter')} className="share-btn twitter">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2s9 5 20 5a9.5 9.5 0 00-9-5.5c4.75 2.25 9 0 9 0"/>
                  </svg>
                  <span>X</span>
                </button>
                <button onClick={() => handleShare('telegram')} className="share-btn telegram">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21.198 2.433A2.014 2.014 0 0019.33 1c-1.98 0-7.062 3.406-14.087 9.423C3.36 12.5.818 14.643.818 14.643l3.581 1.08c.264.809 1.58 4.944 1.922 5.844.342.9 1.357 1.264 2.266.989 1.08-.335 10.899-6.702 10.899-6.702l3.711-3.596a1.328 1.328 0 00-.999-2.145c-.547.022-1.045.327-1.323.886l-2.953 5.754s-5.359 3.354-5.902 3.708c-.544.354-1.086.354-1.086.354-.27 0-.54-.135-.809-.405l-1.264-1.995"/>
                  </svg>
                  <span>Telegram</span>
                </button>
                <button onClick={() => handleShare('discord')} className="share-btn discord">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.211.375-.444.864-.607 1.25a18.27 18.27 0 00-5.487 0c-.163-.386-.405-.875-.618-1.25a.077.077 0 00-.079-.036 19.736 19.736 0 00-4.885 1.515.07.07 0 00-.033.03c-3.106 4.643-3.957 9.182-3.538 13.662a.083.083 0 00.036.056 19.921 19.921 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.042-.106 13.107 13.107 0 01-1.872-.892.077.077 0 00-.008-.128c.126-.095.252-.194.373-.293a.075.075 0 00.031-.066c2.64 1.973 5.5 1.973 8.1 0a.075.075 0 00.031.065c.12.1.247.198.373.294a.077.077 0 00-.007.127c-.6.37-1.217.678-1.873.891a.077.077 0 00-.042.107c.352.699.764 1.365 1.225 1.994a.077.077 0 00.084.029 19.963 19.963 0 005.993-3.031.076.076 0 00.036-.055c.462-4.645-.38-8.682-1.6-13.662a.061.061 0 00-.033-.031M8.38 11.5c-1.162 0-2.125-1.068-2.125-2.378 0-1.31.963-2.378 2.125-2.378 1.161 0 2.125 1.068 2.125 2.378 0 1.31-.964 2.378-2.125 2.378m7.24 0c-1.161 0-2.125-1.068-2.125-2.378 0-1.31.964-2.378 2.125-2.378 1.162 0 2.125 1.068 2.125 2.378 0 1.31-.963 2.378-2.125 2.378"/>
                  </svg>
                  <span>Discord</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="coming-soon-features">
          <h2>What's Coming</h2>
          <div className="coming-soon-features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <Users size={28} />
              </div>
              <h3>Virtual Rooms</h3>
              <p>Create spaces for your community. Private hangouts for friends, fans, and groups.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <MessageCircle size={28} />
              </div>
              <h3>Group Video Calls</h3>
              <p>Crystal-clear group video. Connect with up to 100 people in your hangout space.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Lock size={28} />
              </div>
              <h3>Privacy Focused</h3>
              <p>End-to-end encryption. You control who joins, what's recorded, and how data is used.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <BarChart3 size={28} />
              </div>
              <h3>Room Analytics</h3>
              <p>Track engagement. See who's active, peak times, and growth metrics for your spaces.</p>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="coming-soon-benefits">
          <h2>Why Choose PNPtv Hangouts</h2>
          <div className="benefits-list">
            <div className="benefit-item">
              <div className="benefit-icon">
                <Zap size={24} />
              </div>
              <div className="benefit-content">
                <h4>Built for Creators</h4>
                <p>Monetize your hangouts. Subscriptions, memberships, and exclusive room access.</p>
              </div>
            </div>

            <div className="benefit-item">
              <div className="benefit-icon">
                <Users size={24} />
              </div>
              <div className="benefit-content">
                <h4>Community First</h4>
                <p>Not just video chat. Rooms, roles, permissions, and member management built-in.</p>
              </div>
            </div>

            <div className="benefit-item">
              <div className="benefit-icon">
                <Lock size={24} />
              </div>
              <div className="benefit-content">
                <h4>Completely Private</h4>
                <p>Your data stays yours. No tracking, no third-party integrations, full control.</p>
              </div>
            </div>

            <div className="benefit-item">
              <div className="benefit-icon">
                <MessageCircle size={24} />
              </div>
              <div className="benefit-content">
                <h4>Integrated Chat</h4>
                <p>Text, voice, and video. All in one place. No switching between apps.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="coming-soon-use-cases">
          <h2>Perfect For</h2>
          <div className="use-cases-grid">
            <div className="use-case-card">
              <div className="use-case-title">Study Groups</div>
              <p>Collaborate with classmates. Share screens, chat, and study together in real-time.</p>
            </div>

            <div className="use-case-card">
              <div className="use-case-title">Gaming Crews</div>
              <p>Squad up with voice chat while gaming. Integrated presence and member status.</p>
            </div>

            <div className="use-case-card">
              <div className="use-case-title">Fan Communities</div>
              <p>Connect with superfans. Exclusive hangouts for your most loyal followers.</p>
            </div>

            <div className="use-case-card">
              <div className="use-case-title">Team Meetings</div>
              <p>Remote work done right. Persistent rooms for your team with built-in collaboration.</p>
            </div>

            <div className="use-case-card">
              <div className="use-case-title">Social Mixers</div>
              <p>Meet new people. Public hangout spaces with discovery and networking features.</p>
            </div>

            <div className="use-case-card">
              <div className="use-case-title">Artist Collectives</div>
              <p>Creative collaboration. Share work, brainstorm, and create together live.</p>
            </div>
          </div>
        </section>

        {/* Pricing Preview Section */}
        <section className="coming-soon-pricing-preview">
          <h2>Flexible Pricing</h2>
          <div className="pricing-cards">
            <div className="pricing-card">
              <h4>Personal</h4>
              <p className="price">Free</p>
              <ul>
                <li>1 Private Hangout</li>
                <li>Up to 10 Members</li>
                <li>Text + Voice Chat</li>
                <li>Basic Moderation</li>
              </ul>
            </div>

            <div className="pricing-card featured">
              <span className="badge">Most Popular</span>
              <h4>Creator</h4>
              <p className="price">$9.99<span>/month</span></p>
              <ul>
                <li>Unlimited Hangouts</li>
                <li>Up to 50 Members</li>
                <li>Video + Voice + Text</li>
                <li>Advanced Moderation</li>
                <li>Member Monetization</li>
                <li>Analytics Dashboard</li>
              </ul>
            </div>

            <div className="pricing-card">
              <h4>Community</h4>
              <p className="price">$29.99<span>/month</span></p>
              <ul>
                <li>Unlimited Everything</li>
                <li>Up to 500 Members</li>
                <li>All Features</li>
                <li>Custom Branding</li>
                <li>Priority Support</li>
                <li>Advanced Analytics</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Timeline Section */}
        <section className="coming-soon-timeline">
          <h2>Launch Timeline</h2>
          <div className="timeline">
            <div className="timeline-item active">
              <div className="timeline-marker"></div>
              <div className="timeline-content">
                <h4>Phase 1: Beta</h4>
                <p>Core features testing. Private hangouts and group video calls in closed beta.</p>
                <span className="timeline-status">In Progress</span>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-marker"></div>
              <div className="timeline-content">
                <h4>Phase 2: Onboarding</h4>
                <p>Waitlist members get exclusive access. Feedback shapes final product.</p>
                <span className="timeline-status">Q1 2026</span>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-marker"></div>
              <div className="timeline-content">
                <h4>Phase 3: Full Release</h4>
                <p>Available to all PNPtv members. All monetization and moderation features live.</p>
                <span className="timeline-status">Q2 2026</span>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="coming-soon-faq">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-grid">
            <div className="faq-item">
              <h4>What makes Hangouts different?</h4>
              <p>Built specifically for communities with built-in moderation, monetization, and discovery. Not just video chat.</p>
            </div>

            <div className="faq-item">
              <h4>Can I create hangouts for free?</h4>
              <p>Yes! One private hangout is free. Upgrade to Creator tier for unlimited rooms and monetization.</p>
            </div>

            <div className="faq-item">
              <h4>How do I make money?</h4>
              <p>Subscriptions to exclusive hangouts, memberships, tips, and sponsorships. Keep 75-85% of earnings.</p>
            </div>

            <div className="faq-item">
              <h4>Is video required?</h4>
              <p>Nope! Text and voice only hangouts are fully supported. Use what works for you and your community.</p>
            </div>

            <div className="faq-item">
              <h4>How many people can join?</h4>
              <p>Free tier: 10 members. Creator: 50 members. Community: 500 members per hangout.</p>
            </div>

            <div className="faq-item">
              <h4>What about data privacy?</h4>
              <p>Encrypted by default. No tracking, no ads, no selling data. You have complete control.</p>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="coming-soon-final-cta">
          <div className="final-cta-content">
            <h2>Join the Waitlist</h2>
            <p>Be there from day one. Get exclusive early access and shape the future of Hangouts.</p>
            <div className="final-cta-form">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="coming-soon-input"
              />
              <button onClick={handleSubmit} disabled={isSubmitting} className="coming-soon-submit-btn">
                {isSubmitting ? <div className="spinner-sm"></div> : <Bell size={16} />}
                {isSubmitting ? 'Sending...' : 'Reserve Now'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
