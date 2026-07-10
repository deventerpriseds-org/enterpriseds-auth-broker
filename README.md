# enterpriseds-auth-broker

**Central OAuth redirect broker for all EnterpriseDS apps.** ⚠️ **DO NOT DELETE OR RENAME** —
deleting this (or its Azure resource) breaks Google sign-in for **every** EnterpriseDS app.

## What it is

A single static page (`public/index.html`) hosted on its own Azure Static Web App
(`enterpriseds-auth-broker`). It is the **one** URL registered in the shared Google
OAuth client, so individual apps never need per-app entries in the Google console.

## How it works

1. An app starts Google sign-in with `redirect_uri` = this broker, and encodes its own
   origin in the OAuth `state` (base64url `{p:"google", o:"https://<app-host>"}`).
2. Google redirects the browser here with `?code&state`.
3. This page decodes `state.o` and **forwards the code back to that app**
   (`https://<app-host>/?code=…&state=…`).
4. The app exchanges the code via **its own** API (the `redirect_uri` in the exchange is
   this broker, so Google validates it). The broker holds **no secrets** and does no
   token exchange.

Defense-in-depth: the forwarder only redirects to `*.azurestaticapps.net` origins, so a
forged `state` can't turn it into an open redirect. Add custom-domain origins to that
allowlist in `public/index.html` if apps move off the default hostnames.

## Setup (one-time)

Needs the org `AZURE_*` Actions secrets (shared in `deventerpriseds-org`).

1. **Actions → Provision Auth Broker → Run workflow** — creates the Static Web App and
   prints the broker hostname.
2. Register that hostname (`https://<broker-host>`) as an **Authorized redirect URI** on
   the shared Google OAuth client. This is the *only* Google-console step, ever.
3. Point every app's `VITE_GOOGLE_REDIRECT_URI` (in each app's `web-deploy.yml`) at the
   broker hostname.

Pushes to `main` under `public/**` redeploy the page automatically.
