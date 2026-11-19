/**
 * Access-request approval for xuyiwu.com (Google Apps Script web app).
 *
 * How it works
 *   1. A visitor fills in the request form on the private landing page.
 *      The page POSTs the details to this script (doPost).
 *   2. The script emails OWNER_EMAIL a message with an "Approve access" link.
 *      The link carries a signed copy of the request, so nothing is stored
 *      and nobody can forge one without the secret kept in Script Properties.
 *   3. Clicking the link (doGet) emails the visitor ACCESS_URL. Ignore the
 *      email to decline. Each link works once and expires after 14 days.
 *
 * The script never emails anyone except you, until you click Approve.
 * Setup steps are in SETUP.md next to this file.
 */

// ===== Settings: edit these =====
const OWNER_EMAIL = 'wuxuyi001@gmail.com';                            // where requests are sent
const OWNER_NAME = 'Xuyi Wu';                                         // shown as the sender name
const ACCESS_URL = 'https://xuyiwu.com/home-22c3e54d4798.html';       // link sent to approved people
const MAX_REQUESTS_PER_DAY = 20;                                      // stops form spam
const SAME_EMAIL_COOLDOWN_SECONDS = 3600;                             // one request per address per hour
const APPROVAL_LINK_DAYS = 14;                                        // approval links expire after this

// Rejects commas and semicolons so one field can never become several recipients.
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

// ===== Web app entry points =====

/** Receives the request form from the landing page. */
function doPost(e) {
  try {
    const p = (e && e.parameter) || {};

    // Hidden "website" field: people ignore it, bots fill it in.
    if (clean_(p.website, 200)) return text_('ok');

    const name = clean_(p.name, 80);
    const email = clean_(p.email, 120).toLowerCase();
    const company = clean_(p.company, 120);
    const reason = clean_(p.reason, 600);
    if (!name || !EMAIL_RE.test(email)) return text_('invalid');

    const cache = CacheService.getScriptCache();
    const cooldownKey = 'req_' + email;
    if (cache.get(cooldownKey)) return text_('ok'); // same address asked recently
    if (MailApp.getRemainingDailyQuota() < 2) return text_('busy');
    if (!takeDailySlot_()) return text_('busy');
    cache.put(cooldownKey, '1', SAME_EMAIL_COOLDOWN_SECONDS);

    const payload = encode_({ n: name, e: email, t: Date.now() });
    const link = ScriptApp.getService().getUrl() +
      '?a=approve&p=' + encodeURIComponent(payload) +
      '&s=' + encodeURIComponent(sign_(payload));

    sendOwnerEmail_({ name: name, email: email, company: company, reason: reason }, link);
    return text_('ok');
  } catch (err) {
    console.error(err);
    return text_('error');
  }
}

/** Handles the Approve link from the owner's email. */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.a !== 'approve' || !p.p || !p.s) {
    return page_('Private site', 'This is the access-approval service for ' + OWNER_NAME + "'s website.");
  }

  try {
    if (!verify_(p.p, p.s)) return page_('Link not valid', 'This approval link is not valid.');

    const req = decode_(p.p);
    if (!req || !EMAIL_RE.test(String(req.e))) return page_('Link not valid', 'This approval link is not valid.');
    if (Date.now() - Number(req.t) > APPROVAL_LINK_DAYS * 24 * 3600 * 1000) {
      return page_('Link expired', 'This approval link has expired. Ask them to send a new request.');
    }

    const id = p.s.slice(0, 22);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (readUsed_().indexOf(id) !== -1) {
        return page_('Already approved', 'Access was already sent to ' + req.n + ' (' + req.e + '). Nothing more was sent.');
      }
      sendAccessEmail_(req.n, req.e);
      markUsed_(id);
    } finally {
      lock.releaseLock();
    }
    return page_('Access approved', 'I emailed the access link to ' + req.n + ' (' + req.e + ').');
  } catch (err) {
    console.error(err);
    return page_('Something went wrong', 'The email was not sent. Try the link again, or email them directly.');
  }
}

// ===== Run these from the editor =====

/** Run once: shows Google's permission screen so the script is allowed to send mail. */
function authorizeOnce() {
  console.log('Mail quota left today: ' + MailApp.getRemainingDailyQuota());
  console.log('Web app URL (after you deploy): ' + ScriptApp.getService().getUrl());
}

/** Run to check the whole flow: sends the approval request email to OWNER_EMAIL. */
function sendTestRequest() {
  const out = doPost({ parameter: {
    name: 'Test Person', email: OWNER_EMAIL, company: 'Test Co', reason: 'Checking the approval email'
  } });
  console.log(out.getContent());
}

// ===== Emails =====

function sendOwnerEmail_(r, link) {
  const text = [
    'Someone asked to see your website.',
    '',
    'Name: ' + r.name,
    'Email: ' + r.email,
    'Company / role: ' + (r.company || '-'),
    'Reason: ' + (r.reason || '-'),
    '',
    'To approve (this emails them your access link):',
    link,
    '',
    'To decline, ignore this email. The link stops working after ' + APPROVAL_LINK_DAYS + ' days.',
    'You can also reply to this email to write to them directly.'
  ].join('\n');

  const html =
    '<p>Someone asked to see your website.</p>' +
    '<table cellpadding="4" style="border-collapse:collapse">' +
    '<tr><td><b>Name</b></td><td>' + esc_(r.name) + '</td></tr>' +
    '<tr><td><b>Email</b></td><td>' + esc_(r.email) + '</td></tr>' +
    '<tr><td><b>Company / role</b></td><td>' + esc_(r.company || '-') + '</td></tr>' +
    '<tr><td><b>Reason</b></td><td>' + esc_(r.reason || '-') + '</td></tr>' +
    '</table>' +
    '<p><a href="' + esc_(link) + '" style="display:inline-block;background:#e76f3c;color:#fff;' +
    'padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">Approve access</a></p>' +
    '<p style="color:#5d6a82">Approving emails them your access link. To decline, ignore this email. ' +
    'The button stops working after ' + APPROVAL_LINK_DAYS + ' days. You can also reply to write to them directly.</p>';

  MailApp.sendEmail({
    to: OWNER_EMAIL,
    subject: 'Access request: ' + r.name,
    body: text,
    htmlBody: html,
    replyTo: r.email,
    name: OWNER_NAME + ' website'
  });
}

function sendAccessEmail_(name, email) {
  const first = String(name).split(/\s+/)[0] || 'there';
  const body = [
    'Hi ' + first + ',',
    '',
    'Thanks for asking. Your request has been approved. You can view my website here:',
    '',
    ACCESS_URL,
    '',
    'The link opens the site directly, so please do not pass it on. If you have any questions, just reply to this email.',
    '',
    'Best wishes,',
    OWNER_NAME
  ].join('\n');

  MailApp.sendEmail({
    to: email,
    subject: 'Your access to ' + OWNER_NAME + "'s website",
    body: body,
    replyTo: OWNER_EMAIL,
    name: OWNER_NAME
  });
}

// ===== Signing =====

function secret_() {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty('SECRET');
  if (s) return s;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    s = props.getProperty('SECRET');
    if (!s) {
      s = Utilities.getUuid() + Utilities.getUuid();
      props.setProperty('SECRET', s);
    }
  } finally {
    lock.releaseLock();
  }
  return s;
}

function sign_(payload) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, secret_()));
}

function verify_(payload, sig) {
  const expected = sign_(payload);
  if (typeof sig !== 'string' || sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

function encode_(obj) {
  return Utilities.base64EncodeWebSafe(JSON.stringify(obj), Utilities.Charset.UTF_8);
}

function decode_(s) {
  return JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(s)).getDataAsString('UTF-8'));
}

// ===== Small stores (Script Properties) =====

function takeDailySlot_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    const today = Utilities.formatDate(new Date(), 'Etc/UTC', 'yyyy-MM-dd');
    let day;
    try { day = JSON.parse(props.getProperty('DAY') || '{}'); } catch (err) { day = {}; }
    if (day.date !== today) day = { date: today, count: 0 };
    if (day.count >= MAX_REQUESTS_PER_DAY) return false;
    day.count++;
    props.setProperty('DAY', JSON.stringify(day));
    return true;
  } finally {
    lock.releaseLock();
  }
}

function readUsed_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('USED') || '[]'); } catch (err) { return []; }
}

function markUsed_(id) {
  const used = readUsed_();
  used.push(id);
  PropertiesService.getScriptProperties().setProperty('USED', JSON.stringify(used.slice(-120)));
}

// ===== Helpers =====

/** Trims, flattens line breaks and control characters, and caps the length. */
function clean_(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function text_(s) {
  return ContentService.createTextOutput(s);
}

function page_(title, message) {
  const html =
    '<div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:15vh auto;padding:0 20px;color:#1b2538">' +
    '<h2 style="color:#14213d">' + esc_(title) + '</h2><p>' + esc_(message) + '</p></div>';
  return HtmlService.createHtmlOutput(html).setTitle(title);
}
