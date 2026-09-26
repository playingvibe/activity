# Security policy

## Reporting a vulnerability

**Please don't open a public issue or pull request for a security problem.**

Use GitHub's private reporting instead: on this repository, open the **Security** tab and choose
**Report a vulnerability**. It reaches the maintainers only. If that isn't available to you, message
a maintainer in the [support server](https://discord.gg/nMJJ8PAcD9) and ask for a private channel,
without describing the problem in public.

Please include what you found, where (a file and a line), how to reproduce it, and what you think an
attacker could do with it. Never include, or test with, other people's data or accounts.

You'll get an answer within a few days. We'll tell you when it's fixed and, if you want, credit you.

## What's in scope

- The code in this repository and the Activity it builds: how it handles the sign-in token, what it sends
  to the bot, what it renders from what the bot sends (injection through a track title, a username or a
  server name, for example), and its build configuration.

## What isn't

- Discord, its Embedded App SDK, Vercel, or any other service the project uses: report those to their
  owners.
- The bot's own code and hosting, which aren't in this repository. If you found something there, the
  private route above still reaches us.
- Findings that need a device or browser you already control, and denial-of-service by volume.

## What this repository holds

No secrets. The application's credentials are set on the hosts and never committed. If you find one in this
repository or its history, that is a vulnerability: report it as above.
