import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './lib/api.js';
import { clearSession, loadSession, saveSession } from './lib/session.js';

const plans = [
  {
    key: 'free',
    name: 'Free',
    price: 'GHS 0',
    cadence: '/ month',
    description: 'For sellers testing ReadySend with a small number of real buyers.',
    features: ['Up to 15 orders per month', 'Core order tracking', 'Customer confirmation links', 'Basic dashboard', '30-day order history']
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 'GHS 39',
    cadence: '/ month',
    description: 'For active online sellers who need better order control.',
    features: ['Up to 150 orders per month', 'Monthly sales summary', 'Better filters and search', 'Priority support', 'Cancelled and returned order insights'],
    featured: true
  },
  {
    key: 'growth',
    name: 'Growth',
    price: 'GHS 89',
    cadence: '/ month',
    description: 'For sellers managing higher order volume across social channels.',
    features: ['Up to 500 orders per month', 'Advanced filters and search', 'Exportable monthly sales summary', 'Full order history', 'Delivery and cancellation trend view']
  },
  {
    key: 'business',
    name: 'Business',
    price: 'GHS 179',
    cadence: '/ month',
    description: 'Future team plan for larger sellers after the core product is proven.',
    features: ['Multiple staff accounts', 'Exports', 'Deeper reporting', 'Role permissions', 'Team activity log'],
    future: true
  }
];

const emptySignup = {
  businessName: '',
  email: '',
  password: '',
  whatsappPhone: '',
  category: 'clothing',
  mainChannel: 'whatsapp',
  logoUrl: ''
};

const emptyLogin = { email: '', password: '' };

const emptyOrder = {
  buyerName: '',
  buyerPhone: '',
  productName: '',
  productVariation: '',
  quantity: 1,
  amount: '',
  currency: 'GHS',
  deliveryArea: '',
  deliveryAddress: '',
  deliveryDate: '',
  paymentTerms: 'unpaid',
  internalNotes: ''
};

const emptyContact = {
  name: '',
  email: '',
  subject: '',
  message: ''
};

const viewHashes = {
  landing: '#home',
  about: '#about',
  pricing: '#pricing',
  contact: '#contact',
  auth: '#register',
  dashboard: '#dashboard'
};

function viewFromHash(hasSession) {
  const hash = window.location.hash || '';
  if (hash.startsWith('#shop/')) return 'shop';
  const match = Object.entries(viewHashes).find(([, value]) => value === hash);
  const nextView = match?.[0];

  if (nextView === 'dashboard' && !hasSession) return 'auth';
  if (nextView) return nextView;
  return hasSession ? 'dashboard' : 'landing';
}

function buildReceiptMessage(order, seller) {
  return `Hi ${order.buyerName}, please confirm your ${order.productName} order from ${seller.businessName} on ReadySend: ${order.confirmationUrl}`;
}

function toOrderForm(order) {
  return {
    buyerName: order.buyerName || '',
    buyerPhone: order.buyerPhone || '',
    productName: order.productName || '',
    productVariation: order.productVariation || '',
    quantity: order.quantity || 1,
    amount: order.amount || '',
    currency: order.currency || 'GHS',
    deliveryArea: order.deliveryArea || '',
    deliveryAddress: order.deliveryAddress || '',
    deliveryDate: order.deliveryDate || '',
    paymentTerms: order.paymentTerms || 'unpaid',
    internalNotes: order.internalNotes || ''
  };
}

function shopSlugFromHash() {
  const hash = window.location.hash || '';
  return hash.startsWith('#shop/') ? decodeURIComponent(hash.slice('#shop/'.length)) : '';
}

function activePlanName(subscription) {
  return subscription?.status === 'active' ? subscription.plan_name : 'Free';
}

function subscriptionSummary(subscription) {
  if (!subscription) return 'Free trial active.';
  if (subscription.status === 'active') {
    return `${subscription.plan_name} active until ${new Date(subscription.current_period_end).toLocaleDateString()}.`;
  }
  if (subscription.status === 'expired') {
    return `${subscription.plan_name} expired. Renew Pro or Growth to continue creating orders.`;
  }
  return `${subscription.plan_name} is ${subscription.status}. Renew Pro or Growth to continue creating orders.`;
}

function planKeyFromSubscription(subscription) {
  return subscription?.status === 'active' ? subscription.plan_key : 'free';
}

function paidPlans() {
  return plans.filter((plan) => plan.key === 'pro' || plan.key === 'growth');
}

function formatMoney(currency, amount) {
  return `${currency || 'GHS'} ${Number(amount || 0).toFixed(2)}`;
}

function orderMatchesSearch(order, query) {
  if (!query) return true;
  const text = [
    order.buyerName,
    order.buyerPhone,
    order.productName,
    order.productVariation,
    order.deliveryArea,
    order.paymentTerms,
    order.fulfillmentStatus,
    order.confirmationStatus
  ].filter(Boolean).join(' ').toLowerCase();

  return text.includes(query.toLowerCase());
}

function csvEscape(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function useScrollReveal(dependencyKey) {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('[data-reveal]'));

    if (!elements.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          } else {
            entry.target.classList.remove('is-visible');
          }
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.18 }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [dependencyKey]);
}

function PublicOrderPage({ slug, notify }) {
  const [seller, setSeller] = useState(null);
  const [request, setRequest] = useState(emptyOrder);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    async function loadSeller() {
      try {
        const payload = await api.getPublicSeller(slug);
        setSeller(payload.seller);
      } catch (err) {
        setError(err.message);
        notify('Shop not found', err.message, 'error');
      }
    }

    loadSeller();
  }, [slug]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.submitBuyerRequest(slug, { ...request, deliveryDate: request.deliveryDate || today });
      setSubmitted(true);
      setRequest(emptyOrder);
      notify('Order request sent', 'The seller will review your request before dispatch.', 'success');
    } catch (err) {
      setError(err.message);
      notify('Could not send request', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell public-order-page">
      <section className="page-hero" data-reveal>
        <p className="eyebrow">ReadySend order request</p>
        <h1>{seller ? `Request an order from ${seller.businessName}` : 'Loading seller...'}</h1>
        <p>Send your order details. The seller will review the request and send a confirmation receipt before dispatch.</p>
      </section>
      <form className="panel form-grid" onSubmit={handleSubmit} data-reveal>
        <Field label="Your name"><input value={request.buyerName} onChange={(event) => setRequest({ ...request, buyerName: event.target.value })} required /></Field>
        <Field label="Phone number"><input value={request.buyerPhone} onChange={(event) => setRequest({ ...request, buyerPhone: event.target.value })} required /></Field>
        <Field label="Product"><input value={request.productName} onChange={(event) => setRequest({ ...request, productName: event.target.value })} required /></Field>
        <Field label="Variation"><input value={request.productVariation} onChange={(event) => setRequest({ ...request, productVariation: event.target.value })} placeholder="Size, color, style" /></Field>
        <Field label="Quantity"><input type="number" min="1" value={request.quantity} onChange={(event) => setRequest({ ...request, quantity: event.target.value })} required /></Field>
        <Field label="Amount/Budget"><input type="number" min="0" step="0.01" value={request.amount} onChange={(event) => setRequest({ ...request, amount: event.target.value })} required /></Field>
        <Field label="Currency"><input maxLength="3" value={request.currency} onChange={(event) => setRequest({ ...request, currency: event.target.value.toUpperCase() })} required /></Field>
        <Field label="Delivery area"><input value={request.deliveryArea} onChange={(event) => setRequest({ ...request, deliveryArea: event.target.value })} required /></Field>
        <Field label="Delivery address"><textarea value={request.deliveryAddress} onChange={(event) => setRequest({ ...request, deliveryAddress: event.target.value })} /></Field>
        <Field label="Delivery date"><input type="date" value={request.deliveryDate} min={today} onChange={(event) => setRequest({ ...request, deliveryDate: event.target.value })} /></Field>
        <Field label="Payment terms"><select value={request.paymentTerms} onChange={(event) => setRequest({ ...request, paymentTerms: event.target.value })}><option value="unpaid">Unpaid</option><option value="part_paid">Part paid</option><option value="paid">Paid</option><option value="pay_on_delivery">Pay on delivery</option></select></Field>
        <Field label="Notes"><textarea value={request.internalNotes} onChange={(event) => setRequest({ ...request, internalNotes: event.target.value })} /></Field>
        <button type="submit" className="primary-button wide" disabled={loading || !seller}>{loading ? 'Sending...' : 'Send order request'}</button>
      </form>
    </main>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function PasswordField({ label, value, onChange, minLength, helper, visible, onToggle }) {
  return (
    <Field label={label}>
      <div className="password-control">
        <input
          type={visible ? 'text' : 'password'}
          minLength={minLength}
          value={value}
          onChange={onChange}
          placeholder={helper}
          required
        />
        <button type="button" className="password-toggle" onClick={onToggle} aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      <small className="field-help">{helper}</small>
    </Field>
  );
}

function NotificationModal({ notification, onClose }) {
  if (!notification) return null;

  return (
    <div className="notification-backdrop" role="dialog" aria-modal="true" aria-label={notification.title}>
      <section className={`notification-modal ${notification.type || 'info'}`}>
        <div className="notification-icon" aria-hidden="true">
          {notification.type === 'error' ? '!' : 'i'}
        </div>
        <div>
          <h2>{notification.title}</h2>
          <p>{notification.message}</p>
        </div>
        <button type="button" className="primary-button wide" onClick={onClose}>
          OK
        </button>
      </section>
    </div>
  );
}

function Footer({ onPage }) {
  return (
    <footer className="site-footer">
      <div>
        <a className="brand" href="#home" onClick={() => onPage('landing')}>
          ReadySend
        </a>
        <p>Order confirmation tools for online sellers who sell through DMs, WhatsApp, Instagram, and referrals.</p>
      </div>
      <address className="footer-contact">
        <strong>Contact</strong>
        <a href="mailto:hoodwebworks@gmail.com"><span aria-hidden="true">✉</span> hoodwebworks@gmail.com</a>
        <a href="tel:+233209287952"><span aria-hidden="true">☎</span> +233209287952</a>
        <span><span aria-hidden="true">⌖</span> Accra, Ghana</span>
      </address>
      <div className="footer-bottom">
        <span aria-hidden="true">©</span> 2026 ReadySend. All rights reserved.
      </div>
    </footer>
  );
}

function Navbar({ session, onPage, onAuthClick, onDashboardClick, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  function handleNav(action) {
    action();
    setMenuOpen(false);
  }

  return (
    <>
      <div className="top-info-bar">
        <span>Accra, Ghana</span>
        <span>Support: hoodwebworks@gmail.com</span>
        <span>For online sellers</span>
      </div>
      <header className="site-header">
        <a className="brand" href="#home" onClick={() => onPage('landing')} aria-label="ReadySend home">
          <span className="brand-mark" aria-hidden="true">R</span>
          ReadySend
        </a>
        <nav className="desktop-nav-links" aria-label="Main navigation">
          <button type="button" onClick={() => onPage('landing')}>Home</button>
          <button type="button" onClick={() => onPage('about')}>About us</button>
          <button type="button" onClick={() => onPage('pricing')}>Pricing</button>
          <button type="button" onClick={() => onPage('contact')}>Contact us</button>
          {session ? (
            <>
              <button type="button" className="nav-button" onClick={onDashboardClick}>Dashboard</button>
              <button type="button" className="nav-button muted" onClick={onLogout}>Logout</button>
            </>
          ) : (
            <button type="button" className="nav-button nav-cta" onClick={onAuthClick}>Register seller</button>
          )}
        </nav>
        <a className="header-contact" href="tel:+233209287952">
          <span>Call us</span>
          <strong>+233 20 928 7952</strong>
        </a>
        <div className="nav-menu-wrap" ref={menuRef}>
          <button type="button" className="hamburger-button" aria-label="Open navigation menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            <span></span>
            <span></span>
            <span></span>
          </button>
          {menuOpen ? (
            <nav className="nav-links" aria-label="Main navigation">
              <button type="button" onClick={() => handleNav(() => onPage('landing'))}>Home</button>
              <button type="button" onClick={() => handleNav(() => onPage('about'))}>About us</button>
              <button type="button" onClick={() => handleNav(() => onPage('pricing'))}>Pricing</button>
              <button type="button" onClick={() => handleNav(() => onPage('contact'))}>Contact us</button>
              {session ? (
                <>
                  <button type="button" className="nav-button" onClick={() => handleNav(onDashboardClick)}>Dashboard</button>
                  <button type="button" className="nav-button muted" onClick={() => handleNav(onLogout)}>Logout</button>
                </>
              ) : (
                <button type="button" className="nav-button" onClick={() => handleNav(onAuthClick)}>Register seller</button>
              )}
            </nav>
          ) : null}
        </div>
      </header>
    </>
  );
}

function LandingPage({ session, onAuthClick, onDashboardClick, onPage }) {
  return (
    <main>
      <section className="hero" id="home">
        <div className="hero-copy" data-reveal>
          <p className="eyebrow hero-eyebrow">For online sellers</p>
          <h1>Confirm orders before dispatch, without exposing the seller.</h1>
          <p className="hero-text">
            ReadySend gives social sellers a clean order confirmation link for every buyer, so the dispatch decision is clearer before money, products, and time are lost.
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={session ? onDashboardClick : onAuthClick}>
              {session ? 'Open dashboard' : 'Register seller'}
            </button>
          </div>
        </div>
        <div className="hero-media animated-media" aria-label="Buyer opening a parcel after an online order" data-reveal>
          <img src="https://images.pexels.com/photos/3960574/pexels-photo-3960574.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="Black woman opening a delivery parcel beside a laptop" />
        </div>
      </section>
      <section className="hero-feature-strip" aria-label="ReadySend benefits">
        <article>
          <span>More control</span>
          <p>Review every buyer request before a receipt is created.</p>
        </article>
        <article>
          <span>Less dispatch stress</span>
          <p>Confirm item, delivery, and payment details before sending out.</p>
        </article>
        <article>
          <span>Faster follow-up</span>
          <p>Copy confirmation messages and send them straight into the buyer DM.</p>
        </article>
      </section>
      <section className="section visual-band" data-reveal>
        <div className="visual-collage">
          <div className="visual-frame main-photo">
            <img src="https://images.pexels.com/photos/7857499/pexels-photo-7857499.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="Online shop team managing orders on a laptop" />
          </div>
          <div className="visual-frame inset-photo">
            <img src="https://images.pexels.com/photos/3960574/pexels-photo-3960574.jpeg?auto=compress&cs=tinysrgb&w=900" alt="Black customer checking a delivered parcel" />
          </div>
        </div>
        <div data-reveal>
          <p className="eyebrow">How it works</p>
          <h2>Create the order, share the link, wait for confirmation.</h2>
          <p>Capture buyer and item details, generate a receipt link, then use it as the final checkpoint before delivery.</p>
        </div>
      </section>
      <section className="section story-section" aria-label="ReadySend workflow">
        <div className="story-copy">
          <article data-reveal>
            <span>01</span>
            <h2>The buyer sends the order from your public link.</h2>
            <p>Sellers can post one link in their bio, WhatsApp status, or DM. Buyers fill the order request without seeing the seller dashboard.</p>
          </article>
          <article data-reveal>
            <span>02</span>
            <h2>You review, edit, and approve before dispatch.</h2>
            <p>The seller keeps control of price, delivery details, quantity, and payment terms before a receipt is created.</p>
          </article>
          <article data-reveal>
            <span>03</span>
            <h2>The buyer confirms the receipt.</h2>
            <p>Confirmed receipts give sellers a clearer checkpoint before they spend money on delivery.</p>
          </article>
        </div>
        <div className="story-visual" data-reveal>
          <div className="phone-mockup">
            <div className="phone-topbar"></div>
            <div className="mockup-card active">
              <span>Public order request</span>
              <strong>Black dress · Size M</strong>
              <p>East Legon · Pay on delivery</p>
            </div>
            <div className="mockup-card">
              <span>Seller review</span>
              <strong>Ready for approval</strong>
              <p>Delivery date and amount checked.</p>
            </div>
            <div className="mockup-card confirmed">
              <span>Buyer receipt</span>
              <strong>Confirmed before dispatch</strong>
            </div>
          </div>
        </div>
      </section>
      <section className="section about-section about-feature-section" id="about" data-reveal>
        <div className="about-feature-heading">
          <p className="eyebrow">About us</p>
          <h2>A business tool for sellers who sell through social channels.</h2>
          <p>ReadySend gives informal online selling a clearer operating system: buyer requests, seller review, receipt confirmation, and order tracking in one flow.</p>
          <button type="button" className="secondary-button" onClick={() => onPage('about')}>Read more</button>
        </div>
        <div className="about-values-card">
          <article data-reveal><span>01</span><strong>Confirm before dispatch</strong></article>
          <article data-reveal><span>02</span><strong>Reduce preventable losses</strong></article>
          <article data-reveal><span>03</span><strong>Built for informal commerce</strong></article>
        </div>
      </section>
      <section className="section pricing-section" id="pricing" data-reveal>
        <div>
          <p className="eyebrow">Pricing</p>
          <h2>Start free, upgrade when ReadySend is saving you failed dispatches.</h2>
          <button type="button" className="secondary-button" onClick={() => onPage('pricing')}>View all plans</button>
        </div>
        <div className="pricing-grid homepage-pricing">
          {plans.slice(0, 3).map((plan) => (
            <article className={`pricing-card plan-card ${plan.featured ? 'featured' : ''}`} key={plan.name} data-reveal>
              <span>{plan.name}</span>
              <strong>{plan.price}<small>{plan.cadence}</small></strong>
              <p>{plan.description}</p>
              <button type="button" className={plan.featured ? 'primary-button wide' : 'secondary-button wide'} onClick={() => onPage('pricing')}>
                See plan
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="section contact-section" id="contact" data-reveal>
        <div>
          <p className="eyebrow">Contact us</p>
          <h2>Ready to test ReadySend with real online buyers?</h2>
        </div>
        <div className="contact-preview">
          <p>Use the contact page to ask about seller onboarding, support, or the early pilot.</p>
          <button type="button" className="primary-button" onClick={() => onPage('contact')}>Open contact form</button>
        </div>
      </section>
    </main>
  );
}

function AboutPage() {
  return (
    <main className="page-shell about-page-shell">
      <section className="about-identity-hero" data-reveal>
        <p className="eyebrow">About us</p>
        <h1>Unveiling our identity, vision and values</h1>
        <p>Many sellers do business through WhatsApp, Instagram, TikTok, and referrals. Orders are often confirmed through chat, but sellers still lose money when buyers change details, delay payment, give unclear addresses, or abandon deliveries. ReadySend gives that sales flow a simple business system.</p>
      </section>
      <section className="about-values-panel" data-reveal>
        <article><span>01</span><strong>Order confirmation</strong></article>
        <article><span>02</span><strong>Seller control</strong></article>
        <article><span>03</span><strong>Revenue protection</strong></article>
        <article><span>04</span><strong>Practical commerce</strong></article>
      </section>
      <section className="about-mission-card" data-reveal>
        <article>
          <span className="mission-icon">Vision</span>
          <h2>Make social selling safer before dispatch.</h2>
          <p>ReadySend helps online sellers move from scattered chat confirmations to clear buyer requests, receipt links, and order records.</p>
        </article>
        <article>
          <span className="mission-icon">Mission</span>
          <h2>Reduce preventable seller losses.</h2>
          <p>Each buyer receives a receipt-style confirmation link that captures product, quantity, payment terms, delivery area, and delivery date before dispatch.</p>
        </article>
      </section>
    </main>
  );
}

function PricingPage({ session, onSubscribe }) {
  return (
    <main className="page-shell">
      <section className="page-hero" data-reveal>
        <p className="eyebrow">Pricing</p>
        <h1>Plans from the ReadySend PRD.</h1>
        <p>Start free, then upgrade when ReadySend is preventing enough failed dispatches to pay for itself.</p>
      </section>
      <section className="pricing-grid">
        {plans.map((plan) => (
          <article className={`pricing-card plan-card ${plan.featured ? 'featured' : ''}`} key={plan.name} data-reveal>
            <span>{plan.future ? 'Future plan' : plan.name}</span>
            <strong>{plan.price}<small>{plan.cadence}</small></strong>
            <p>{plan.description}</p>
            <ul>
              {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <button type="button" className={plan.featured ? 'primary-button wide' : 'secondary-button wide'} onClick={() => onSubscribe(plan)}>
              {plan.future ? 'Join waitlist' : session ? `Subscribe to ${plan.name}` : `Register for ${plan.name}`}
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}

function ContactPage({ notify }) {
  const [contact, setContact] = useState(emptyContact);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('');
    setError('');
    setLoading(true);

    try {
      await api.sendContact(contact);
      setContact(emptyContact);
      setStatus('Message sent. We will reply by email.');
      notify('Message sent', 'We will reply by email.', 'success');
    } catch (err) {
      setError(err.message);
      notify('Could not send message', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell contact-page">
      <section className="page-hero" data-reveal>
        <p className="eyebrow">Contact us</p>
        <h1>Send a message to ReadySend.</h1>
        <p>Use the form for product questions, seller onboarding, support, and early pilot requests.</p>
      </section>
      <form className="panel form-grid contact-form" onSubmit={handleSubmit} data-reveal>
        <Field label="Name">
          <input value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} required />
        </Field>
        <Field label="Email">
          <input type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} required />
        </Field>
        <Field label="Subject">
          <input value={contact.subject} onChange={(event) => setContact({ ...contact, subject: event.target.value })} required />
        </Field>
        <Field label="Message">
          <textarea value={contact.message} onChange={(event) => setContact({ ...contact, message: event.target.value })} required />
        </Field>
        <button type="submit" className="primary-button wide" disabled={loading}>
          {loading ? 'Sending...' : 'Send message'}
        </button>
      </form>
    </main>
  );
}

function AuthPage({ selectedPlan, onAuthed, onBack, notify }) {
  const [mode, setMode] = useState('signup');
  const [signup, setSignup] = useState(emptySignup);
  const [login, setLogin] = useState(emptyLogin);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await api.signup(signup);
      saveSession(session);
      onAuthed(session);
    } catch (err) {
      setError(err.message);
      notify('Could not create account', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await api.login(login);
      saveSession(session);
      onAuthed(session);
    } catch (err) {
      setError(err.message);
      notify('Could not log in', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" data-reveal>
        <div className="auth-heading">
          <p className="eyebrow">Register seller</p>
          <h1>{mode === 'signup' ? 'Create your seller account' : 'Log back in'}</h1>
          <p>{selectedPlan ? `Selected plan: ${selectedPlan.name}. Create an account to continue.` : 'Set up your ReadySend profile and start creating receipt links.'}</p>
        </div>
        <div className="tab-row" role="tablist" aria-label="Authentication mode">
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Sign up</button>
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
        </div>
        {mode === 'signup' ? (
          <form className="form-grid" onSubmit={handleSignup}>
            <Field label="Business name"><input value={signup.businessName} onChange={(event) => setSignup({ ...signup, businessName: event.target.value })} required /></Field>
            <Field label="Email"><input type="email" value={signup.email} onChange={(event) => setSignup({ ...signup, email: event.target.value })} required /></Field>
            <PasswordField
              label="Password"
              value={signup.password}
              minLength="8"
              helper="Use at least 8 characters."
              visible={showSignupPassword}
              onToggle={() => setShowSignupPassword((visible) => !visible)}
              onChange={(event) => setSignup({ ...signup, password: event.target.value })}
            />
            <Field label="Phone number"><input value={signup.whatsappPhone} onChange={(event) => setSignup({ ...signup, whatsappPhone: event.target.value })} required /></Field>
            <Field label="Category"><select value={signup.category} onChange={(event) => setSignup({ ...signup, category: event.target.value })}><option value="clothing">Clothing</option><option value="beauty">Beauty</option><option value="food">Food</option><option value="accessories">Accessories</option><option value="other">Other</option></select></Field>
            <Field label="Main channel"><select value={signup.mainChannel} onChange={(event) => setSignup({ ...signup, mainChannel: event.target.value })}><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="other">Other</option></select></Field>
            <button type="submit" className="primary-button wide" disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</button>
          </form>
        ) : (
          <form className="form-grid" onSubmit={handleLogin}>
            <Field label="Email"><input type="email" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} required /></Field>
            <PasswordField
              label="Password"
              value={login.password}
              helper="Enter the password used when signing up."
              visible={showLoginPassword}
              onToggle={() => setShowLoginPassword((visible) => !visible)}
              onChange={(event) => setLogin({ ...login, password: event.target.value })}
            />
            <button type="submit" className="primary-button wide" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
          </form>
        )}
      </section>
    </main>
  );
}

function Dashboard({ session, selectedPlan, onLogout, onPage, notify }) {
  const seller = session.seller;
  const profileSheetRef = useRef(null);
  const [order, setOrder] = useState(emptyOrder);
  const [orders, setOrders] = useState([]);
  const [buyerRequests, setBuyerRequests] = useState([]);
  const [status, setStatus] = useState(selectedPlan ? `Selected plan: ${selectedPlan.name}. Payment checkout will be connected next.` : '');
  const [subscription, setSubscription] = useState(null);
  const [publicSlug, setPublicSlug] = useState(seller.sellerSlug || '');
  const [createdOrder, setCreatedOrder] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState('');
  const [editingRequestId, setEditingRequestId] = useState('');
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function refreshOrders(showStatus = false) {
    if (!seller?.id) return;
    setError('');
    setRefreshing(true);

    try {
      const payload = await api.listOrders(seller.id);
      setOrders(payload.orders || []);
      const requestPayload = await api.listBuyerRequests(seller.id);
      setBuyerRequests(requestPayload.requests || []);
      if (showStatus) {
        setStatus('Orders refreshed.');
      }
    } catch (err) {
      setError(err.message);
      notify('Could not refresh orders', err.message, 'error');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    ensurePublicSlug();
    refreshOrders();
    refreshSubscription();
  }, [seller?.id]);

  async function ensurePublicSlug() {
    if (!seller?.id) return;
    if (publicSlug) return;

    try {
      const payload = await api.ensureSellerSlug(seller.id);
      setPublicSlug(payload.seller.sellerSlug);
    } catch (err) {
      setError(err.message);
      notify('Could not prepare public link', err.message, 'error');
    }
  }

  useEffect(() => {
    if (!profileOpen) return undefined;

    function handlePointerDown(event) {
      if (profileSheetRef.current && !profileSheetRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setProfileOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen]);

  async function refreshSubscription() {
    if (!seller?.id) return;

    try {
      const payload = await api.getSubscription(seller.id);
      setSubscription(payload.subscription);
    } catch (err) {
      setError(err.message);
      notify('Could not load subscription', err.message, 'error');
    }
  }

  async function verifyLatestPayment() {
    if (!seller?.id) return;
    setError('');
    setBillingLoading(true);

    try {
      const payload = await api.verifyLatestPayment(seller.id);
      setSubscription(payload.subscription);
      setStatus(payload.subscription ? `${payload.subscription.plan_name} plan is active.` : `Payment status: ${payload.paymentStatus}.`);
      notify('Payment checked', payload.subscription ? `${payload.subscription.plan_name} plan is active.` : `Payment status: ${payload.paymentStatus}.`, 'success');
    } catch (err) {
      setError(err.message);
      notify('Could not verify payment', err.message, 'error');
    } finally {
      setBillingLoading(false);
    }
  }

  async function startPaystackCheckout(plan) {
    if (!plan || plan.key === 'free' || plan.future) return;
    setError('');
    setBillingLoading(true);

    try {
      const payload = await api.startSubscription({ sellerId: seller.id, plan: plan.key });
      window.location.href = payload.authorizationUrl;
    } catch (err) {
      setError(err.message);
      notify('Could not open Paystack', err.message, 'error');
      setBillingLoading(false);
    }
  }

  async function handleCreateOrder(event) {
    event.preventDefault();
    setError('');
    setStatus('');
    setCreatedOrder(null);
    setLoading(true);
    try {
      const body = { ...order, sellerId: seller.id, deliveryDate: order.deliveryDate || today };
      const payload = editingRequestId
        ? await api.updateBuyerRequest(editingRequestId, { action: 'approve', order: body })
        : editingOrderId
          ? await api.updateOrder(editingOrderId, body)
          : await api.createOrder(body);
      const savedOrder = payload.order;
      setOrders((current) => {
        if (editingOrderId) {
          return current.map((item) => (item.id === savedOrder.id ? savedOrder : item));
        }

        return [savedOrder, ...current];
      });
      if (editingRequestId) {
        setBuyerRequests((current) => current.map((item) => (item.id === editingRequestId ? payload.request : item)));
      }
      setOrder(emptyOrder);
      setEditingOrderId('');
      setEditingRequestId('');
      setCreatedOrder(editingOrderId ? null : savedOrder);
      setStatus(editingOrderId ? 'Order updated.' : 'Buyer receipt is ready to send.');
      notify(editingOrderId ? 'Order updated' : 'Receipt link created', editingOrderId ? 'The pending order was updated.' : 'Buyer receipt is ready to copy.', 'success');
    } catch (err) {
      setError(err.message);
      notify('Could not save order', err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function copyReceipt(orderToCopy) {
    if (!orderToCopy.confirmationUrl) {
      setError('This older order does not have a saved receipt link. Create a new order to generate a copyable receipt link.');
      notify('No saved receipt link', 'This older order does not have a saved receipt link. Create a new order to generate a copyable receipt link.', 'error');
      return;
    }

    const message = buildReceiptMessage(orderToCopy, seller);
    await navigator.clipboard.writeText(message);
    setCopiedOrderId(orderToCopy.id);
    notify('Copied', 'The buyer receipt message is ready to paste.', 'success');
    window.setTimeout(() => setCopiedOrderId(''), 1800);
  }

  function startEditing(orderToEdit) {
    setError('');
    setStatus('');
    setCreatedOrder(null);
    setEditingOrderId(orderToEdit.id);
    setEditingRequestId('');
    setOrder(toOrderForm(orderToEdit));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startRequestApproval(requestToApprove) {
    setError('');
    setStatus('');
    setCreatedOrder(null);
    setEditingOrderId('');
    setEditingRequestId(requestToApprove.id);
    setOrder(toOrderForm(requestToApprove));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function rejectBuyerRequest(requestId) {
    try {
      const payload = await api.updateBuyerRequest(requestId, { action: 'reject' });
      setBuyerRequests((current) => current.map((item) => (item.id === requestId ? payload.request : item)));
      notify('Request rejected', 'The buyer request was moved out of pending requests.', 'success');
    } catch (err) {
      setError(err.message);
      notify('Could not reject request', err.message, 'error');
    }
  }

  function cancelEditing() {
    setEditingOrderId('');
    setEditingRequestId('');
    setOrder(emptyOrder);
  }

  function exportMonthlySummary() {
    const rows = monthlyOrders.map((item) => [
      item.createdAt,
      item.buyerName,
      item.buyerPhone,
      item.productName,
      item.quantity,
      item.currency,
      item.amount,
      item.paymentTerms,
      item.confirmationStatus,
      item.fulfillmentStatus,
      item.deliveryArea
    ]);
    const header = ['Created at', 'Buyer', 'Phone', 'Product', 'Quantity', 'Currency', 'Amount', 'Payment terms', 'Confirmation', 'Fulfillment', 'Delivery area'];
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `readysend-${seller.businessName || 'seller'}-${today.slice(0, 7)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify('Export ready', 'The monthly summary CSV has been downloaded.', 'success');
  }

  const planKey = planKeyFromSubscription(subscription);
  const hasProTools = planKey === 'pro' || planKey === 'growth';
  const hasGrowthTools = planKey === 'growth';
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthlyOrders = orders.filter((item) => {
    const created = new Date(item.createdAt);
    return created.getMonth() === currentMonth && created.getFullYear() === currentYear;
  });
  const monthlyTotal = monthlyOrders.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const confirmedMonthlyTotal = monthlyOrders
    .filter((item) => item.confirmationStatus === 'confirmed')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const returnedOrCancelledCount = orders.filter((item) => item.fulfillmentStatus === 'returned' || item.fulfillmentStatus === 'cancelled' || item.confirmationStatus === 'cancelled').length;
  const deliveryRiskCount = orders.filter((item) => item.confirmationStatus !== 'confirmed' || item.fulfillmentStatus === 'returned' || item.fulfillmentStatus === 'cancelled').length;
  const filteredOrders = orders.filter((item) => {
    const statusMatches = orderStatusFilter === 'all'
      || (orderStatusFilter === 'pending' && item.confirmationStatus !== 'confirmed')
      || item.confirmationStatus === orderStatusFilter
      || item.fulfillmentStatus === orderStatusFilter;
    const paymentMatches = paymentFilter === 'all' || item.paymentTerms === paymentFilter;
    return statusMatches && paymentMatches && orderMatchesSearch(item, orderSearch);
  });
  const pendingOrders = filteredOrders.filter((item) => item.confirmationStatus !== 'confirmed');
  const confirmedOrders = filteredOrders.filter((item) => item.confirmationStatus === 'confirmed');
  const pendingBuyerRequests = buyerRequests.filter((item) => item.status === 'pending');
  const publicOrderLink = publicSlug ? `${window.location.origin}/#shop/${encodeURIComponent(publicSlug)}` : '';

  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar" data-reveal>
        <button type="button" className="brand brand-button" onClick={() => onPage('landing')}>ReadySend</button>
        <div className="seller-summary">
          <span className="sidebar-label">Seller</span>
          <strong>{seller.businessName}</strong>
          <p>{seller.whatsappPhone}</p>
          <p>{seller.category} seller</p>
          <p>Main channel: {seller.mainChannel}</p>
          <p>Plan: {activePlanName(subscription)}</p>
          <p>{subscriptionSummary(subscription)}</p>
        </div>
        <button type="button" className="secondary-button wide" onClick={() => onPage('pricing')}>
          View pricing
        </button>
        <div className="profile-plan-list desktop-profile-plan-list">
          {subscription?.status !== 'active'
            ? paidPlans().map((plan) => (
                <button type="button" key={plan.key} disabled={billingLoading} onClick={() => startPaystackCheckout(plan)}>
                  {plan.name} - {plan.price}{plan.cadence}
                </button>
              ))
            : null}
          <button type="button" disabled={billingLoading} onClick={verifyLatestPayment}>
            Verify latest payment
          </button>
        </div>
        <button type="button" className="secondary-button" onClick={onLogout}>Logout</button>
      </aside>
      <section className="dashboard-main">
        <div className="dashboard-heading" data-reveal>
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1>Create buyer confirmation links</h1>
          </div>
          <div className="dashboard-actions">
            <button type="button" className="secondary-button" onClick={() => refreshOrders(true)} disabled={refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh orders'}
            </button>
            <button type="button" className="mobile-profile-button" aria-label="Open seller profile" onClick={() => setProfileOpen(true)}>
              {seller.businessName?.slice(0, 1).toUpperCase() || 'S'}
            </button>
          </div>
        </div>
        <div className="dashboard-grid">
          <section className="panel plan-tools-panel" data-reveal>
            <div className="plan-tools-heading">
              <div>
                <p className="eyebrow">Plan tools</p>
                <h2>{activePlanName(subscription)} seller features</h2>
              </div>
              <button type="button" className="secondary-button" onClick={() => onPage('pricing')}>
                View plans
              </button>
            </div>
            <div className="metric-grid">
              <article>
                <span>This month</span>
                <strong>{monthlyOrders.length}</strong>
                <p>Orders created</p>
              </article>
              <article>
                <span>Monthly sales</span>
                <strong>{formatMoney('GHS', monthlyTotal)}</strong>
                <p>{hasProTools ? 'Available on Pro and Growth' : 'Upgrade to unlock richer summaries'}</p>
              </article>
              <article>
                <span>Confirmed sales</span>
                <strong>{formatMoney('GHS', confirmedMonthlyTotal)}</strong>
                <p>Confirmed receipts this month</p>
              </article>
              <article>
                <span>Risk checks</span>
                <strong>{deliveryRiskCount}</strong>
                <p>{hasProTools ? 'Unconfirmed, returned, or cancelled orders' : 'Basic tracking active'}</p>
              </article>
            </div>
            <div className="feature-access-grid">
              <article className={hasProTools ? 'available' : ''}>
                <strong>Monthly sales summary</strong>
                <p>{hasProTools ? `Current month value is ${formatMoney('GHS', monthlyTotal)}.` : 'Upgrade to Pro to unlock monthly sales summaries.'}</p>
              </article>
              <article className={hasProTools ? 'available' : ''}>
                <strong>Filters and search</strong>
                <p>{hasProTools ? 'Search by buyer, phone, product, area, payment, and status.' : 'Upgrade to Pro to filter and search order history.'}</p>
              </article>
              <article className={hasProTools ? 'available' : ''}>
                <strong>Cancelled and returned insights</strong>
                <p>{hasProTools ? `${returnedOrCancelledCount} cancelled or returned records found.` : 'Upgrade to Pro to track cancelled and returned order risk.'}</p>
              </article>
              <article className={hasGrowthTools ? 'available' : ''}>
                <strong>Exportable monthly summary</strong>
                <p>{hasGrowthTools ? 'Download the current month as a CSV file.' : 'Growth plan unlocks monthly CSV export.'}</p>
              </article>
            </div>
            {hasGrowthTools ? (
              <button type="button" className="primary-button export-button" onClick={exportMonthlySummary}>
                Export monthly CSV
              </button>
            ) : null}
          </section>
          {hasProTools ? (
            <section className="panel order-filter-panel" data-reveal>
              <h2>{hasGrowthTools ? 'Advanced order filters' : 'Order filters'}</h2>
              <div className="filter-grid">
                <Field label="Search orders">
                  <input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Buyer, phone, product, area" />
                </Field>
                <Field label="Status">
                  <select value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="pending">Pending confirmation</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="returned">Returned</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </Field>
                <Field label="Payment terms">
                  <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                    <option value="all">All payment terms</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="part_paid">Part paid</option>
                    <option value="paid">Paid</option>
                    <option value="pay_on_delivery">Pay on delivery</option>
                  </select>
                </Field>
              </div>
            </section>
          ) : null}
          <section className="panel public-link-panel" data-reveal>
            <h2>Public order link</h2>
            <p>Share this link on WhatsApp Status, Instagram bio, TikTok bio, or in DMs so buyers can send order requests themselves.</p>
            {publicOrderLink ? (
              <div className="public-link-copy">
                <span>{publicOrderLink}</span>
                <button type="button" className="primary-button" onClick={async () => { await navigator.clipboard.writeText(publicOrderLink); notify('Copied', 'Your public order link is ready to share.', 'success'); }}>
                  Copy
                </button>
              </div>
            ) : (
              <p>Preparing your public order link...</p>
            )}
          </section>
          <section className="panel order-list buyer-request-list" data-reveal>
            <h2>Buyer requests</h2>
            {pendingBuyerRequests.length === 0 ? <p className="empty-state">No buyer requests yet.</p> : null}
            {pendingBuyerRequests.map((item) => (
              <article className="order-item buyer-request-item" key={item.id}>
                <div><strong>{item.productName}</strong><span>{item.buyerName} | {item.buyerPhone}</span></div>
                <p>{item.currency} {item.amount} | {item.deliveryArea}</p>
                <div className="order-actions">
                  <button type="button" onClick={() => startRequestApproval(item)}>Edit and approve</button>
                  <button type="button" onClick={() => rejectBuyerRequest(item.id)}>Reject</button>
                </div>
              </article>
            ))}
          </section>
          <form className="panel form-grid" onSubmit={handleCreateOrder} data-reveal>
            <h2>{editingRequestId ? 'Approve buyer request' : editingOrderId ? 'Edit order' : 'Create order'}</h2>
            {createdOrder?.confirmationUrl ? (
              <div className="receipt-share-card">
                <span>Buyer receipt</span>
                <strong>{createdOrder.buyerName}'s confirmation for {createdOrder.productName}</strong>
                <p>{buildReceiptMessage(createdOrder, seller)}</p>
                <div className="receipt-actions">
                  <a className="secondary-button" href={createdOrder.confirmationUrl} target="_blank" rel="noreferrer">Open receipt</a>
                  <button type="button" className="primary-button" onClick={() => copyReceipt(createdOrder)}>
                    {copiedOrderId === createdOrder.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            ) : null}
            <Field label="Buyer name"><input value={order.buyerName} onChange={(event) => setOrder({ ...order, buyerName: event.target.value })} required /></Field>
            <Field label="Buyer phone number"><input value={order.buyerPhone} onChange={(event) => setOrder({ ...order, buyerPhone: event.target.value })} required /></Field>
            <Field label="Product"><input value={order.productName} onChange={(event) => setOrder({ ...order, productName: event.target.value })} required /></Field>
            <Field label="Variation"><input value={order.productVariation} onChange={(event) => setOrder({ ...order, productVariation: event.target.value })} placeholder="Size, color, style" /></Field>
            <Field label="Quantity"><input type="number" min="1" value={order.quantity} onChange={(event) => setOrder({ ...order, quantity: event.target.value })} required /></Field>
            <Field label="Amount"><input type="number" min="0" step="0.01" value={order.amount} onChange={(event) => setOrder({ ...order, amount: event.target.value })} required /></Field>
            <Field label="Currency"><input maxLength="3" value={order.currency} onChange={(event) => setOrder({ ...order, currency: event.target.value.toUpperCase() })} required /></Field>
            <Field label="Delivery area"><input value={order.deliveryArea} onChange={(event) => setOrder({ ...order, deliveryArea: event.target.value })} required /></Field>
            <Field label="Delivery address"><textarea value={order.deliveryAddress} onChange={(event) => setOrder({ ...order, deliveryAddress: event.target.value })} /></Field>
            <Field label="Delivery date"><input type="date" value={order.deliveryDate} min={today} onChange={(event) => setOrder({ ...order, deliveryDate: event.target.value })} /></Field>
            <Field label="Payment terms"><select value={order.paymentTerms} onChange={(event) => setOrder({ ...order, paymentTerms: event.target.value })}><option value="unpaid">Unpaid</option><option value="part_paid">Part paid</option><option value="paid">Paid</option><option value="pay_on_delivery">Pay on delivery</option></select></Field>
            <Field label="Internal notes"><textarea value={order.internalNotes} onChange={(event) => setOrder({ ...order, internalNotes: event.target.value })} /></Field>
            {editingOrderId ? <button type="button" className="secondary-button wide" onClick={cancelEditing}>Cancel edit</button> : null}
            {editingRequestId ? <button type="button" className="secondary-button wide" onClick={cancelEditing}>Cancel approval</button> : null}
            <button type="submit" className="primary-button wide" disabled={loading}>
              {loading ? (editingOrderId || editingRequestId ? 'Saving...' : 'Creating link...') : editingRequestId ? 'Approve and create receipt' : editingOrderId ? 'Save order' : 'Create receipt link'}
            </button>
          </form>
          <section className="panel order-list" data-reveal>
            <h2>Pending orders</h2>
            {pendingOrders.length === 0 ? <p className="empty-state">No pending orders.</p> : null}
            {pendingOrders.map((item) => (
              <article className="order-item" key={item.id}>
                <div><strong>{item.productName}</strong><span>{item.buyerName} | {item.buyerPhone}</span></div>
                <p>{item.currency} {item.amount} | {item.deliveryArea}</p>
                <div className="order-actions">
                  <button type="button" onClick={() => copyReceipt(item)}>{copiedOrderId === item.id ? 'Copied' : 'Copy'}</button>
                  <button type="button" onClick={() => startEditing(item)}>Edit</button>
                </div>
              </article>
            ))}
          </section>
          <section className="panel order-list confirmed-orders" data-reveal>
            <h2>Confirmed orders</h2>
            {confirmedOrders.length === 0 ? <p className="empty-state">No confirmed orders yet.</p> : null}
            {confirmedOrders.map((item) => (
              <article className="order-item confirmed" key={item.id}>
                <div><strong>{item.productName}</strong><span>{item.buyerName} | {item.buyerPhone}</span></div>
                <p>{item.currency} {item.amount} | {item.deliveryArea}</p>
                <div className="order-actions">
                  <span className="confirmed-badge">Confirmed</span>
                  <button type="button" onClick={() => setViewingReceipt(item)}>Open receipt</button>
                </div>
              </article>
            ))}
          </section>
        </div>
      </section>
      {viewingReceipt ? (
        <div className="receipt-modal" role="dialog" aria-modal="true" aria-label="Confirmed receipt">
          <section className="receipt-modal-card">
            <div className="receipt-modal-header">
              <div>
                <p className="eyebrow">Confirmed receipt</p>
                <h2>{viewingReceipt.productName}</h2>
              </div>
              <button type="button" className="text-button" onClick={() => setViewingReceipt(null)}>Close</button>
            </div>
            <dl className="receipt-detail-grid">
              <div><dt>Buyer</dt><dd>{viewingReceipt.buyerName}</dd></div>
              <div><dt>Buyer phone number</dt><dd>{viewingReceipt.buyerPhone}</dd></div>
              <div><dt>Product</dt><dd>{viewingReceipt.productName}</dd></div>
              <div><dt>Variation</dt><dd>{viewingReceipt.productVariation || 'Not specified'}</dd></div>
              <div><dt>Quantity</dt><dd>{viewingReceipt.quantity}</dd></div>
              <div><dt>Amount</dt><dd>{viewingReceipt.currency} {viewingReceipt.amount}</dd></div>
              <div><dt>Delivery area</dt><dd>{viewingReceipt.deliveryArea}</dd></div>
              <div><dt>Delivery date</dt><dd>{viewingReceipt.deliveryDate}</dd></div>
              <div><dt>Payment terms</dt><dd>{viewingReceipt.paymentTerms}</dd></div>
              <div><dt>Status</dt><dd>Confirmed</dd></div>
            </dl>
            {viewingReceipt.deliveryAddress ? <p className="receipt-note">{viewingReceipt.deliveryAddress}</p> : null}
          </section>
        </div>
      ) : null}
      {profileOpen ? (
        <div className="profile-sheet" role="dialog" aria-modal="true" aria-label="Seller profile">
          <section className="profile-sheet-card" ref={profileSheetRef}>
            <div className="profile-sheet-header">
              <div className="profile-avatar">{seller.businessName?.slice(0, 1).toUpperCase() || 'S'}</div>
              <button type="button" className="text-button" onClick={() => setProfileOpen(false)}>Close</button>
            </div>
            <div className="seller-summary">
              <span className="sidebar-label">Seller</span>
              <strong>{seller.businessName}</strong>
              <p>{seller.whatsappPhone}</p>
              <p>{seller.category} seller</p>
              <p>Main channel: {seller.mainChannel}</p>
              <p>Plan: {activePlanName(subscription)}</p>
              <p>{subscriptionSummary(subscription)}</p>
            </div>
            <button type="button" className="secondary-button wide" onClick={() => { setProfileOpen(false); onPage('pricing'); }}>
              View pricing
            </button>
            <div className="profile-plan-list">
              {subscription?.status !== 'active'
                ? paidPlans().map((plan) => (
                    <button type="button" key={plan.key} disabled={billingLoading} onClick={() => startPaystackCheckout(plan)}>
                      {plan.name} - {plan.price}{plan.cadence}
                    </button>
                  ))
                : null}
              <button type="button" disabled={billingLoading} onClick={verifyLatestPayment}>
                Verify latest payment
              </button>
            </div>
            <button type="button" className="primary-button wide" onClick={onLogout}>Logout</button>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState(() => loadSession());
  const [view, setView] = useState(() => viewFromHash(Boolean(loadSession())));
  const [shopSlug, setShopSlug] = useState(() => shopSlugFromHash());
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [notification, setNotification] = useState(null);

  function notify(title, message, type = 'info') {
    setNotification({ title, message, type });
  }

  useScrollReveal(view);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    function handleHashChange() {
      const nextView = viewFromHash(Boolean(loadSession()));
      setShopSlug(shopSlugFromHash());
      setView(nextView);
      const savedScroll = sessionStorage.getItem(`readysend.scroll.${nextView}`);
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: Number(savedScroll || 0), behavior: 'auto' });
      });
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  function goToPage(nextView, options = {}) {
    sessionStorage.setItem(`readysend.scroll.${view}`, String(window.scrollY));
    setView(nextView);
    const nextHash = viewHashes[nextView] || viewHashes.landing;

    if (window.location.hash !== nextHash) {
      if (options.replace) {
        window.history.replaceState(null, '', nextHash);
      } else {
        window.history.pushState(null, '', nextHash);
      }
    }

    const savedScroll = options.restore ? sessionStorage.getItem(`readysend.scroll.${nextView}`) : null;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: Number(savedScroll || 0), behavior: options.restore ? 'auto' : 'smooth' });
    });
  }

  function handleSubscribe(plan) {
    setSelectedPlan(plan);
    if (plan.future) {
      goToPage('contact');
      return;
    }

    if (!session) {
      goToPage('auth');
      return;
    }
    goToPage('dashboard');
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    goToPage('landing');
  }

  let content;
  if (view === 'auth') {
    content = <AuthPage selectedPlan={selectedPlan} notify={notify} onAuthed={(nextSession) => { setSession(nextSession); goToPage('dashboard'); }} onBack={() => goToPage('landing')} />;
  } else if (view === 'dashboard' && session) {
    content = <Dashboard session={session} selectedPlan={selectedPlan} notify={notify} onLogout={handleLogout} onPage={goToPage} />;
  } else if (view === 'about') {
    content = <AboutPage />;
  } else if (view === 'pricing') {
    content = <PricingPage session={session} onSubscribe={handleSubscribe} />;
  } else if (view === 'contact') {
    content = <ContactPage notify={notify} />;
  } else if (view === 'shop') {
    content = <PublicOrderPage slug={shopSlug} notify={notify} />;
  } else {
    content = <LandingPage session={session} onAuthClick={() => goToPage('auth')} onDashboardClick={() => goToPage('dashboard')} onPage={goToPage} />;
  }

  const showHeader = !(view === 'dashboard' && session) && view !== 'shop';
  const showFooter = view !== 'shop';

  return (
    <>
      {showHeader ? <Navbar session={session} onPage={goToPage} onAuthClick={() => goToPage('auth')} onDashboardClick={() => goToPage('dashboard')} onLogout={handleLogout} /> : null}
      {content}
      {showFooter ? <Footer onPage={goToPage} /> : null}
      <NotificationModal notification={notification} onClose={() => setNotification(null)} />
    </>
  );
}
