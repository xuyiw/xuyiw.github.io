# Email approval for the private landing page

This folder starts with an underscore, so GitHub Pages does not publish it.

The flow once it is switched on:

1. A visitor fills in the request form on the private page.
2. You get an email with an **Approve access** button.
3. Click it and the visitor gets an email with the link to your real site.
4. To decline, ignore the email. The button stops working after 14 days.

`Code.gs` is the Google Apps Script that does this. It only ever emails **you**, until you click Approve.
Until you finish the steps below, the page keeps the plain "Request access" email button, so nothing is broken.

## Set it up (about 5 minutes)

Use the Google account you want the emails to be sent from. I would use the same account as the address on your site, so replies match.

1. Go to <https://script.google.com> and click **New project**. Name it, for example, `xuyiwu access approval`.
2. Delete the sample code in the editor and paste in the whole of `Code.gs`. Press **Ctrl+S**.
3. Check the three settings at the top (`OWNER_EMAIL`, `OWNER_NAME`, `ACCESS_URL`). They are already filled in.
4. Give the script permission to send email:
   - In the toolbar, choose the function **`authorizeOnce`** and click **Run**.
   - Click **Review permissions**, pick your account, then **Advanced** and **Go to … (unsafe)**, then **Allow**.
   - Google shows the "unverified app" warning because you wrote the script yourself and have not submitted it for Google's review. The only thing it asks for is permission to send email as you.
5. Click **Deploy → New deployment**, then the gear icon and choose **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
6. In `index.html`, paste that URL between the quotes in `const SCRIPT_URL = '';`, then commit and merge. (Or send it to Claude to do it.)

## Check it works

1. In the script editor, choose **`sendTestRequest`** and click **Run**. You should get an email called "Access request: Test Person" within a minute. Click **Approve access**. You should get the access email (it goes to your own address in this test).
2. After the page is live, open it in a private window and send a request using a **different email address** from yours. (Each address can ask only once an hour, and the test above uses yours.)

## Good to know

- **Changing the code later:** editing in the script editor does nothing live until you click **Deploy → Manage deployments → pencil → Version: New version → Deploy**. The web app URL stays the same.
- **Turning it off:** archive the deployment under **Deploy → Manage deployments**, and set `SCRIPT_URL` back to `''` so the page goes back to the email button.
- **Nothing arrives?** Check spam. In the script editor, **Executions** in the left sidebar shows any errors.
- **Limits built in:** at most 20 requests a day in total, one request per email address per hour, a hidden field that catches bots, and each Approve link works once.
- **Not built in:** the script does not check that the visitor owns the email address they typed, and everyone you approve gets the same link. If the link leaks, ask Claude to change the filename of the real home page and update `ACCESS_URL`.
- **Gmail's free sending limit** is about 100 emails a day, far more than this needs.
