import { useParams, Link } from 'react-router-dom';

const PAGES = {
  about: ['About Khaas', `<p><span class="display-accent" style="font-size:22px">Everyday essentials, crafted.</span></p><p>Khaas is a small Indian retail label making thoughtful apparel, home goods and accessories. We work directly with artisan clusters and small factories, keep our catalog tight, and price honestly — no inflated MRPs, no fake discounts.</p><h3>What we stand for</h3><p>Natural materials, repairable construction, and packaging you don't feel guilty about. Every product page shows exactly what you're getting, and every review on this site is from a verified buyer.</p>`],
  shipping: ['Shipping policy', `<p>We dispatch within <strong>24–48 hours</strong> of order confirmation (48 hrs for QR orders, after payment verification).</p><h3>Charges</h3><p>Flat ₹99 shipping across India. <strong>Free shipping on orders above ₹1,999.</strong></p><h3>Timelines</h3><p>Metro cities: 2–4 working days. Rest of India: 4–7 working days. You'll get tracking details by SMS/email once shipped.</p>`],
  returns: ['Returns & refunds', `<p>Changed your mind? You have <strong>7 days</strong> from delivery to return unused items in original packaging.</p><h3>How it works</h3><p>Write to us from your order page or at care@khaas.in. We arrange a doorstep pickup; refunds go back to the source (UPI refunds within 5–7 working days, COD orders via bank transfer).</p><h3>Not returnable</h3><p>Final-sale items marked at purchase, and products damaged by misuse.</p>`],
  privacy: ['Privacy policy', `<p>We collect only what we need to run your order: contact details, delivery address, and order history.</p><h3>What we never do</h3><p>We never sell your data. Payment screenshots are stored privately and visible only to our verification team. OTP codes are hashed and expire in 5 minutes.</p><h3>Your rights</h3><p>Ask us anytime at care@khaas.in to export or delete your data.</p>`],
  terms: ['Terms of service', `<p>By shopping with Khaas you agree to the following.</p><h3>Orders & pricing</h3><p>Prices are in INR and inclusive of taxes. We re-verify price and stock on our server at checkout; in the rare case of a pricing error we may cancel and refund.</p><h3>QR payments</h3><p>A QR payment submission is a claim for review. Your order ships only after our team verifies the payment.</p>`],
  faq: ['Frequently asked questions', `<h3>How do I pay?</h3><p>UPI/QR (pay, then submit your UTR here) or Cash on Delivery.</p><h3>How long does verification take?</h3><p>QR payments are usually verified within a few business hours.</p><h3>Do you ship outside India?</h3><p>Not yet — we currently ship within India only.</p><h3>How do I track my order?</h3><p>Log in and open <em>My orders</em> — live payment and fulfilment status are shown there.</p>`],
  contact: ['Contact us', `<p>We reply within one business day.</p><h3>Support</h3><p>Email: care@khaas.in<br/>Phone: +91 99999 99999 (Mon–Sat, 10am–6pm IST)</p><p>For order issues, please mention your order number (looks like KH-20260115-AB12CD).</p>`],
};

export default function Info() {
  const { slug } = useParams();
  const page = PAGES[slug];
  if (!page) return <div className="empty"><h3>Page not found</h3><Link className="btn btn-primary" to="/">Home</Link></div>;
  const [title, html] = page;
  return (
    <>
      <h1>{title}</h1>
      <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
