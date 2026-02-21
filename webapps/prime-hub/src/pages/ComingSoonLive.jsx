import React, { useState, useEffect } from 'react';
import { Mail, Bell, Share2, Check, AlertCircle, Zap, Users, Radio, Eye, MessageCircle, Volume2 } from 'lucide-react';
import { api } from '../api/client';
import Layout from '../components/Layout';

export default function ComingSoonLive() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // null, 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [waitlistCount, setWaitlistCount] = useState(2847);

  useEffect(() => {
    // Fetch actual waitlist count
    const fetchWaitlist = async () => {
      try {
        const res = await api.getComingSoonWaitlist('live');
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
      const res = await api.signupComingSoonWaitlist('live', { email });
      if (res.success) {
        setSubmitStatus('success');
        setEmail('');
        // Auto-hide after 3 seconds
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
    const message = "🎬 Get notified when PNPtv LIVE launches! Low-latency streaming, real-time chat, and creator earnings await. Join the waitlist: pnptv.app";
    const url = `${window.location.origin}/live/coming-soon`;

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
              <Zap size={14} />
              <span>Broadcasting Awaits</span>
            </div>

            {/* Main Heading */}
            <h1 className="coming-soon-title">
              🎥 Going Live <span className="shimmer-text">Soon</span>
            </h1>

            {/* Subheading */}
            <p className="coming-soon-subtitle">
              Stream to the world in real-time. Connect with your audience instantly. Earn while you create.
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
              <Radio size={48} />
            </div>
            <div className="float-icon icon-2">
              <Eye size={48} />
            </div>
            <div className="float-icon icon-3">
              <MessageCircle size={48} />
            </div>
          </div>
        </section>

        {/* Signup Section */}
        <section className="coming-soon-signup-section">
          <div className="coming-soon-signup-box">
            <div className="coming-soon-signup-header">
              <h2>Get Early Access</h2>
              <p>Be the first to go live on PNPtv. Join our exclusive waitlist.</p>
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
                  You're on the waitlist! Check your email.
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
              <p>Spread the word</p>
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
                <Zap size={28} />
              </div>
              <h3>Ultra-Low Latency</h3>
              <p>Sub-second delay streaming. Real-time interaction with your audience without the lag.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <MessageCircle size={28} />
              </div>
              <h3>Interactive Chat</h3>
              <p>Engage with viewers in real-time. Polls, reactions, and direct chat with your community.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Volume2 size={28} />
              </div>
              <h3>Crystal Clear Audio</h3>
              <p>Premium audio codec support. Stream with studio-quality sound from your device.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Users size={28} />
              </div>
              <h3>Creator Earnings</h3>
              <p>Earn from your streams. Tips, subscriptions, and revenue sharing on every broadcast.</p>
            </div>
          </div>
        </section>

        {/* Comparison Section */}
        <section className="coming-soon-comparison">
          <h2>PNPtv LIVE vs Traditional Platforms</h2>
          <div className="comparison-table">
            <div className="comparison-row header">
              <div>Feature</div>
              <div>PNPtv LIVE</div>
              <div>Other Platforms</div>
            </div>

            {[
              ['Creator Revenue Share', '75-85%', '20-50%'],
              ['Low Latency', '< 1 second', '5-30 seconds'],
              ['Interactive Chat', 'Yes', 'Limited'],
              ['Mobile Broadcasting', 'Yes', 'Yes (Premium)'],
              ['No Ads (Creator Choice)', 'Yes', 'Forced Ads'],
              ['Community Features', 'Full Integration', 'Limited'],
            ].map((row, idx) => (
              <div key={idx} className="comparison-row">
                <div className="feature-name">{row[0]}</div>
                <div className="pnptv-value">
                  {row[1]}
                  {row[1].includes('Yes') || row[1].includes('%') ? <Check size={16} /> : null}
                </div>
                <div className="other-value">{row[2]}</div>
              </div>
            ))}
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
                <p>Limited streamer access. Testing infrastructure and user experience.</p>
                <span className="timeline-status">In Progress</span>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-marker"></div>
              <div className="timeline-content">
                <h4>Phase 2: Early Access</h4>
                <p>Waitlist members get streaming access. Invite-only for creators.</p>
                <span className="timeline-status">Q1 2026</span>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-marker"></div>
              <div className="timeline-content">
                <h4>Phase 3: Public Launch</h4>
                <p>Full rollout to all PNPtv users. Feature-complete platform.</p>
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
              <h4>When will LIVE launch?</h4>
              <p>We're targeting Q2 2026 for public launch. Waitlist members will get early access in Q1.</p>
            </div>

            <div className="faq-item">
              <h4>Do I need special equipment?</h4>
              <p>No! Stream directly from your smartphone. Professional cameras and mixers also supported.</p>
            </div>

            <div className="faq-item">
              <h4>How do I earn money?</h4>
              <p>Through tips, subscriptions, and revenue sharing on ads (if you opt-in). Keep 75-85% of earnings.</p>
            </div>

            <div className="faq-item">
              <h4>Can I go live with friends?</h4>
              <p>Yes! Co-streaming and group broadcasts are core features of PNPtv LIVE.</p>
            </div>

            <div className="faq-item">
              <h4>Is there a minimum viewer count?</h4>
              <p>No minimums. Stream to 1 person or 1,000. You control everything.</p>
            </div>

            <div className="faq-item">
              <h4>What about my privacy?</h4>
              <p>Full creator control. Choose who can view, comment, and interact with your streams.</p>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="coming-soon-final-cta">
          <div className="final-cta-content">
            <h2>Don't Miss the Launch</h2>
            <p>Be among the first to stream on PNPtv LIVE. Join our waitlist today.</p>
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
                {isSubmitting ? 'Sending...' : 'Notify Me'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
