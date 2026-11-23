export default function Privacy() {
  return (
    <div className="container" style={{ padding: '34px 20px 60px', maxWidth: 820, fontSize: 14, lineHeight: 1.85, color: '#3c3833' }}>
      <h1 className="serif" style={{ fontWeight: 400, fontSize: 32 }}>Privacy notice</h1>
      <p><em>Last updated: November 2026 · Applies to scentora online orders.</em></p>

      <h2 className="serif" style={{ fontWeight: 400, fontSize: 22 }}>What we collect</h2>
      <ul>
        <li><strong>Contact details</strong> — your name and mobile number (required for delivery and order confirmation), plus your email address if you choose to give it.</li>
        <li><strong>Delivery address</strong> — house/street, area, city, state, PIN code and an optional landmark.</li>
        <li><strong>Order history</strong> — items you order, totals, and delivery status.</li>
        <li><strong>Account data</strong> — if you register: your name, mobile number, optional email and a securely hashed password. We never store your password in plain text.</li>
      </ul>

      <h2 className="serif" style={{ fontWeight: 400, fontSize: 22 }}>What we never collect</h2>
      <ul>
        <li>Card numbers, UPI PINs, net-banking passwords or any banking credentials. SCENTORA is <strong>Cash on Delivery only</strong> — payment happens at your doorstep.</li>
      </ul>

      <h2 className="serif" style={{ fontWeight: 400, fontSize: 22 }}>How we use your details</h2>
      <ul>
        <li>To process, confirm, dispatch and deliver your order (we will call your order mobile number).</li>
        <li>To provide order support and handle returns, cancellations and replacements.</li>
        <li>Promotional messages (offers, new arrivals) <strong>only if you opt in</strong> — via the consent checkbox at signup or in your account. You can withdraw consent at any time from your account page or by contacting support.</li>
      </ul>

      <h2 className="serif" style={{ fontWeight: 400, fontSize: 22 }}>Order tracking &amp; security</h2>
      <p>Guest orders can be looked up only with the order ID <em>and</em> the mobile number used at checkout. Your account, addresses and order history are visible only to you (and to SCENTORA administrators who process orders). Access to customer data inside our team is restricted and logged.</p>

      <h2 className="serif" style={{ fontWeight: 400, fontSize: 22 }}>Who we share data with</h2>
      <ul>
        <li>Delivery and fulfilment partners handling your parcel.</li>
        <li>Service providers that run this website (database hosting, image hosting, email delivery), only for operating the store.</li>
        <li>We do not sell your personal data.</li>
      </ul>

      <h2 className="serif" style={{ fontWeight: 400, fontSize: 22 }}>Your choices &amp; rights</h2>
      <ul>
        <li>Withdraw promotional consent any time.</li>
        <li>Ask us to correct your details or delete your account by contacting support with your registered mobile number.</li>
        <li>Guest checkout is available if you prefer not to create an account.</li>
      </ul>

      <h2 className="serif" style={{ fontWeight: 400, fontSize: 22 }}>Contact</h2>
      <p>Questions about this notice or your data: contact us via the mobile number printed on your order confirmation, or on our social channels. We respond during delivery-day hours.</p>
    </div>
  );
}
