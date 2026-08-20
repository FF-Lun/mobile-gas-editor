# Mobile GAS Editor

A phone-friendly Google Apps Script (GAS) web app that lets you read, edit, save, version, and deploy **other** GAS projects — entirely from your mobile browser, with no external hosting.

- Syntax-highlighted code editor (CodeMirror 6) with line numbers, bracket matching, and line wrapping
- A **function picker** that scans the file and lets you select an entire function body with one tap (great for pasting AI-suggested replacements without touching the rest of the file)
- Find & replace across the whole file
- Register multiple target projects (spreadsheet-bound or standalone) once, then switch between them from a dropdown
- Save code, create a new version, and update an existing deployment — all with tap-based pickers (no fragile native `prompt()` dialogs)
- Remembers your chosen deployment target per project, so you only pick it once

This tool manages **other** GAS projects via the [Apps Script API](https://developers.google.com/apps-script/api). It does not need to be a container-bound script itself.

---

## Prerequisites

- A Google account
- At least one **existing GAS deployment** on each project you want to manage (this tool can *update* an existing deployment, but the Apps Script API cannot create a project's very first deployment — see [Limitations](#limitations))

---

## Installation

### 1. Create the project

1. On your phone (or desktop), go to [script.new](https://script.new) to create a new, blank standalone Apps Script project.
2. Rename the project to something like **"Mobile GAS Editor"**.

### 2. Add the code

1. In the built-in editor, replace the default `Code.gs` content with the contents of [`Code.gs`](./Code.gs) from this repo.
2. Add a new file, choose type **HTML**, name it `Editor` (so it becomes `Editor.html`), and paste in the contents of [`Editor.html`](./Editor.html).
3. Save both files.

### 3. Add OAuth scopes to the manifest

1. In the project, open **Project Settings** (gear icon) and enable **"Show appsscript.json manifest file in editor"**.
2. Open `appsscript.json` and add an `oauthScopes` array so it looks like this:

   ```json
   {
     "timeZone": "Etc/GMT-8",
     "dependencies": {},
     "exceptionLogging": "STACKDRIVER",
     "runtimeVersion": "V8",
     "oauthScopes": [
       "https://www.googleapis.com/auth/script.projects",
       "https://www.googleapis.com/auth/script.deployments",
       "https://www.googleapis.com/auth/script.external_request"
     ]
   }
   ```

   (Keep your existing `timeZone` value if it's different. Make sure there's a comma after `"runtimeVersion": "V8"`.)

### 4. Enable the Apps Script API for this project's Cloud project

Every Apps Script project is backed by a Google Cloud project. By default it's a hidden, auto-generated one that you can't manage — you need to switch to a **standard Cloud project** you own before the Apps Script API will work.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and either use an existing project or create a new one (free, no billing required). Note its **Project number** (shown on the dashboard).
2. Back in your Apps Script project, open **Project Settings** → scroll to **"Google Cloud Platform (GCP) Project"** → click **"Change project"** → paste in the project number → confirm.
3. Still in Cloud Console, go to **APIs & Services → Enabled APIs & services → + Enable APIs and Services**, search for **"Apps Script API"**, and click **Enable**.

### 5. Configure the OAuth consent screen

1. In Cloud Console, go to **APIs & Services → OAuth consent screen**.
2. If the app is in **Testing** mode, go to the **Audience** (or **Test users**) tab and add your own Google account email as a test user. Without this, even you will be blocked from authorizing.
3. Optional: rename the app under **App information** if it shows a name from a different project you'd previously used this Cloud project for.

### 6. Deploy as a web app

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Type: **Web app**.
3. Execute as: **Me**. Who has access: **Only myself** (recommended, since this tool can read/write your other projects).
4. Click **Deploy**, then authorize when prompted — you'll see an "unverified app" warning since this is a personal script; click **Advanced → Go to [project name] (unsafe)** to proceed. This is expected for personal-use scripts that haven't gone through Google's verification process.
5. Copy the web app URL. Bookmark it or add it to your phone's home screen for one-tap access.

---

## First-time use

1. Open the web app URL.
2. Tap **＋ Add** (＋新增) to register your first target project: give it a friendly name, then paste that project's full Apps Script URL (either a spreadsheet-bound project's `.../d/{scriptId}/edit` URL, or a standalone project's `.../projects/{scriptId}/edit` URL — both formats are recognized automatically).
3. Select the project, then a file, and the code will load into the editor.

## Typical workflow

- **Edit a whole function**: use the **function picker** dropdown to select an entire function body, then paste or type the replacement.
- **Rename something everywhere**: use the **Find / Replace** bar.
- **Save**: writes your changes back to the live project source (visible immediately in the native editor too).
- **Create new version**: snapshots the current code as a numbered version (does *not* affect the live deployment yet).
- **Update deployment**: points an existing deployment at a version you just created, so the live web app URL actually serves the new code. The first time you do this for a project, you'll pick which deployment to target from a tappable list; it's remembered afterward.

---

## Limitations

- **Cannot create a project's first deployment.** The Apps Script API can only *update* an existing deployment, not create the very first one. Before using this tool to manage deployments for a project, create at least one deployment manually in the native editor first.
- **Cannot create container-bound scripts.** The Apps Script API can create new *standalone* projects, but not scripts bound to a new spreadsheet/doc. Binding a script to a new container still requires opening the native editor once (Extensions → Apps Script).
- **No auto-discovery of a spreadsheet's bound script.** Google doesn't expose an API for "given a spreadsheet, what's its script ID" — you register the pairing once by pasting the script's own URL, and the tool remembers it.
- Tested primarily on mobile Chrome/Safari. Some in-app browsers (e.g. embedded WebViews in chat apps) may behave unpredictably with certain UI elements.

---

## Credits / stack

- [CodeMirror 6](https://codemirror.net/) for the editor, loaded from [esm.sh](https://esm.sh/)
- [Google Apps Script API](https://developers.google.com/apps-script/api) for reading/writing project source, versions, and deployments
