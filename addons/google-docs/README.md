# Whoosh for Google Docs

Checks the script you're writing in Google Docs, right where you write it. A sidebar marks every reference in the document with how your room will read it (green lands, amber risky, red won't land, gray not measured), jumps to a reference when you click it, and puts the swap you pick into the document, changing only the words the swap changes.

It isn't published to the Google Workspace Marketplace. It runs as a script bound to a document, so anyone can use it by copying a document that carries it.

## How it works

- `Code.gs` does the document work: reads the script (or the selection), colors the references, selects one, and applies or undoes a swap. It needs only access to the current document and permission to show a sidebar.
- `Sidebar.html` shows the Whoosh web app's `/addon` page in a frame and relays its requests to `Code.gs`. It accepts messages only from the web app's origin, and the web app only answers a `googleusercontent.com` frame (where Google serves sidebars).
- The analysis itself runs on the web app, the same pipeline as the website. Nothing from the document is stored.

References are addressed by their words plus where they were when the script was sent, so marks and swaps still find their place after you've typed elsewhere in the document. If a line itself changed since the check, the add-on tells you rather than guess where it went.

## Set it up in a document

1. Open a Google Doc, then **Extensions → Apps Script**.
2. Replace the contents of `Code.gs` with this folder's `Code.gs`.
3. Add an HTML file named `Sidebar` (**+ → HTML**) and paste in `Sidebar.html`.
4. In **Project Settings**, tick **Show "appsscript.json" manifest file in editor**, then replace the manifest with this folder's `appsscript.json`.
5. Save, then reload the document. A **Whoosh** menu appears next to Help; choose **Check this room**.

The first time, Google asks you to authorize the script. Because it isn't a published add-on, Google may show "Google hasn't verified this app"; choose **Advanced → Go to Whoosh** to continue. The script asks only for the current document and the sidebar.

`Sidebar.html` points at the public deployment. To use your own, change both URLs in it (`src` and `APP_ORIGIN`).

## Share it

Share the document as "Anyone with the link can view", then hand out its link with `/edit` replaced by `/copy`. Opening that link makes a copy for the visitor, with the script included.

## Tests

`code.test.ts` runs `Code.gs` against a small stand-in for Apps Script's DocumentApp (`fake-docs.ts`): reading the script and the selection, marking the right occurrence, clearing only the add-on's own colors, selecting across text elements, and applying and undoing a swap. Run it with `npm test`.
