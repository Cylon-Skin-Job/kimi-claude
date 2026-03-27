---
title: "Child Tickets & Cron Jobs"
priority: medium
status: not-started
depends-on: 01-agent-prompts
---

# Child Tickets & Cron Jobs

Agents creating work for other agents, and scheduled ticket factories.

## Tasks

### Child Ticket Parsing
- [ ] Add output parsing in runner/index.js — detect `CHILD_TICKET: bot-name "title"` in wire output
- [ ] Call createTicket() with parsed title, assignee, and parent ticket reference
- [ ] Record child ticket ID in parent manifest.json
- [ ] Enforce max_depth from agent.json (circuit breaker for infinite chains)
- [ ] Test: agent declares child ticket → ticket created → dispatches on next cycle

### Cron Job Ticket Factories
- [ ] Create cron/ workspace or folder for scheduled jobs
- [ ] Write daily wiki freshness cron: `create-ticket.js --title "Daily wiki freshness check" --assignee kimi-wiki`
- [ ] Write weekly code review cron (when kimi-review agent exists)
- [ ] Set up launchd plist or crontab entries on macOS
- [ ] Test: cron fires → ticket appears → agent dispatches → completes
